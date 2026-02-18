// AWS CDK core imports
import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { Duration } from "aws-cdk-lib";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import { Code, LayerVersion, Runtime } from "aws-cdk-lib/aws-lambda";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { VpcStack } from "./vpc-stack";
import { DatabaseStack } from "./database-stack";
import { Fn } from "aws-cdk-lib";
import { Asset } from "aws-cdk-lib/aws-s3-assets";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as logs from "aws-cdk-lib/aws-logs";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as bedrock from "aws-cdk-lib/aws-bedrock";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { WebSocketLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { WebSocketLambdaAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";

// Stack properties for API Gateway configuration
interface ApiGatewayStackProps extends cdk.StackProps {
  ecrRepositories: { [key: string]: ecr.Repository }; // ECR repositories for Lambda Docker images
}

/**
 * ApiGatewayStack creates the API Gateway REST API with authentication,
 * authorization, WAF protection, and Lambda integration layers
 */
export class ApiGatewayStack extends cdk.Stack {
  // API Gateway REST API instance
  private readonly api: apigateway.SpecRestApi;
  // Cognito user pool client for authentication
  public readonly appClient: cognito.UserPoolClient;
  // Cognito user pool for user management
  public readonly userPool: cognito.UserPool;
  // Cognito identity pool for AWS credential federation
  public readonly identityPool: cognito.CfnIdentityPool;
  // Lambda layers for shared dependencies
  private readonly layerList: { [key: string]: lambda.ILayerVersion };
  // API Gateway stage ARN
  public readonly stageARN_APIGW: string;
  // API Gateway base URL
  public readonly apiGW_basedURL: string;

  // Secrets Manager secret reference
  public readonly secret: secretsmanager.ISecret;
  // WebSocket API for chat streaming
  private wsApi!: apigwv2.WebSocketApi;
  private wsStage!: apigwv2.WebSocketStage;
  // DynamoDB tables for notification system
  public readonly notificationTable!: dynamodb.Table;
  public readonly connectionTable!: dynamodb.Table;
  // EventBridge bus for notification events
  public readonly notificationEventBus!: events.EventBus;
  // Getter methods for accessing stack resources
  public getEndpointUrl = () => this.api.url;
  public getUserPoolId = () => this.userPool.userPoolId;

  public getUserPoolClientId = () => this.appClient.userPoolClientId;
  public getIdentityPoolId = () => this.identityPool.ref;
  public getWebSocketUrl = () => this.wsStage.url;
  public getNotificationTable = () => this.notificationTable;
  public getConnectionTable = () => this.connectionTable;
  public addLayer = (name: string, layer: lambda.ILayerVersion) =>
    (this.layerList[name] = layer);
  public getLayers = () => this.layerList;

  constructor(
    scope: Construct,
    id: string,
    db: DatabaseStack,
    vpcStack: VpcStack,
    props: ApiGatewayStackProps,
  ) {
    super(scope, id, props);

    // Initialize Lambda layers collection
    this.layerList = {};

    // Create Lambda layer for JWT verification (Node.js)
    const jwt = new lambda.LayerVersion(this, "aws-jwt-verify", {
      code: lambda.Code.fromAsset("./layers/aws-jwt-verify.zip"),
      compatibleRuntimes: [lambda.Runtime.NODEJS_22_X],
      description: "Contains the aws-jwt-verify library for JS",
    });

    // Create Lambda layer for PostgreSQL client (Node.js)
    const postgres = new lambda.LayerVersion(this, "postgres", {
      code: lambda.Code.fromAsset("./layers/postgres.zip"),
      compatibleRuntimes: [lambda.Runtime.NODEJS_22_X],
      description: "Contains the postgres library for JS",
    });

    // Create Lambda layer for PostgreSQL client (Python)
    const psycopgLayer = new lambda.LayerVersion(this, "psycopgLambdaLayer", {
      code: lambda.Code.fromAsset("./layers/psycopg2.zip"),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_11],
      description: "Lambda layer containing the psycopg2 Python library",
    });

    // Import AWS Powertools layer for Python observability
    const powertoolsLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      `${id}-PowertoolsLayer`,
      `arn:aws:lambda:${this.region}:017000801446:layer:AWSLambdaPowertoolsPythonV2:78`,
    );

    // Register all layers for use by Lambda functions
    this.layerList["jwt"] = jwt;
    this.layerList["postgres"] = postgres;
    this.layerList["psycopg2"] = psycopgLayer;
    this.layerList["powertools"] = powertoolsLayer;

    // Create Cognito user pool for user authentication
    const userPoolName = `${id}-UserPool`;
    this.userPool = new cognito.UserPool(this, `${id}-pool`, {
      userPoolName: userPoolName,
      signInAliases: {
        email: true, // Allow sign-in with email
      },
      selfSignUpEnabled: true, // Allow users to register themselves
      autoVerify: {
        email: true, // Automatically verify email addresses
      },
      userVerification: {
        emailSubject: "LAIGO AI Assistant - Verify your email",
        emailBody: `
                    <html>
                        <head>
                            <style>
                            body {
                                font-family: Outfit, sans-serif;
                                background-color: #F5F5F5;
                                color: #111835;
                                margin: 0;
                                padding: 0;
                                font-size: 16px;
                            }
                            .email-container {
                                background-color: #ffffff;
                                width: 100%;
                                max-width: 600px;
                                margin: 0 auto;
                                padding: 20px;
                                border-radius: 8px;
                                border: 1px solid #ddd;
                            }
                            .header {
                                text-align: center;
                                margin-bottom: 20px;
                            }
                            .header img {
                                width: 100px;
                                height: auto;
                            }
                            .main-content {
                                text-align: center;
                                font-size: 18px;
                                color: #444;
                                margin-bottom: 30px;
                            }
                            .code {
                                display: inline-block;
                                background-color: #111835;
                                color: #ffffff;
                                font-size: 24px;
                                font-weight: bold;
                                padding: 15px 25px;
                                border-radius: 4px;
                                margin-top: 20px;
                                margin-bottom: 20px;
                            }
                            .footer {
                                text-align: center;
                                font-size: 14px;
                                color: #888;
                            }
                            .footer a {
                                color: #546bdf;
                                text-decoration: none;
                            }
                            </style>
                            <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600&display=swap" rel="stylesheet">
                        </head>
                        <body>
                            <div class="email-container">
                            <div class="header">
                                <h1>LAIGO AI Assistant</h1>
                            </div>
                            <div class="main-content">
                                <p>Thank you for signing up for LAIGO AI Assistant!</p>
                                <p>Verify your email by using the code below:</p>
                                <div class="code">{####}</div>
                                <p>If you did not request this verification, please ignore this email.</p>
                            </div>
                            <div class="footer">
                                <p>Please do not reply to this email.</p>
                                <p>LAIGO AI Assistants, 2025</p>
                            </div>
                            </div>
                        </body>
                    </html>
          `,
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      passwordPolicy: {
        minLength: 10, // Minimum password length
        requireLowercase: true, // Require lowercase letters
        requireUppercase: true, // Require uppercase letters
        requireDigits: true, // Require numbers
        requireSymbols: true, // Require special characters
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY, // Allow password recovery via email
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Delete user pool when stack is destroyed
    });

    // Create user pool client for application authentication
    this.appClient = this.userPool.addClient(`${id}-pool`, {
      userPoolClientName: userPoolName,
      authFlows: {
        userPassword: true, // Enable username/password authentication
        custom: true, // Enable custom authentication flows
        userSrp: true, // Enable Secure Remote Password protocol
      },
    });

    // Create Cognito identity pool for AWS credential federation
    this.identityPool = new cognito.CfnIdentityPool(
      this,
      `${id}-identity-pool`,
      {
        allowUnauthenticatedIdentities: false, // Disallow unauthenticated access for security
        identityPoolName: `${id}IdentityPool`,
        cognitoIdentityProviders: [
          {
            clientId: this.appClient.userPoolClientId,
            providerName: this.userPool.userPoolProviderName,
          },
        ],
      },
    );

    // Store Cognito configuration in Secrets Manager for frontend application
    const secretsName = `${id}-LAIGO_Cognito_Secrets`;
    this.secret = new secretsmanager.Secret(this, secretsName, {
      secretName: secretsName,
      description: "Cognito Secrets for authentication",
      secretObjectValue: {
        VITE_COGNITO_USER_POOL_ID: cdk.SecretValue.unsafePlainText(
          this.userPool.userPoolId,
        ),
        VITE_COGNITO_USER_POOL_CLIENT_ID: cdk.SecretValue.unsafePlainText(
          this.appClient.userPoolClientId,
        ),
        VITE_AWS_REGION: cdk.SecretValue.unsafePlainText(this.region),
        VITE_IDENTITY_POOL_ID: cdk.SecretValue.unsafePlainText(
          this.identityPool.ref,
        ),
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Helper function to create IAM policy statements
    const createPolicyStatement = (actions: string[], resources: string[]) => {
      return new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: actions,
        resources: resources,
      });
    };

    // Load OpenAPI specification from file
    const asset = new Asset(this, "SampleAsset", {
      path: "OpenAPI_Swagger_Definition.yaml",
    });

    // Transform OpenAPI spec for API Gateway
    const data = Fn.transform("AWS::Include", { Location: asset.s3ObjectUrl });

    // Create CloudWatch log group for API access logs
    const accessLogGroup = new logs.LogGroup(this, `${id}-ApiAccessLogs`, {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create API Gateway REST API from OpenAPI specification
    this.api = new apigateway.SpecRestApi(this, `${id}-APIGateway`, {
      apiDefinition: apigateway.AssetApiDefinition.fromInline(data),
      endpointTypes: [apigateway.EndpointType.REGIONAL], // Regional endpoint
      restApiName: `${id}-API`,
      deploy: true, // Automatically deploy the API
      cloudWatchRole: true, // Enable CloudWatch logging
      deployOptions: {
        stageName: "prod", // Production stage
        loggingLevel: apigateway.MethodLoggingLevel.ERROR, // Log errors only
        dataTraceEnabled: true, // Enable request/response logging
        metricsEnabled: true, // Enable CloudWatch metrics
        accessLogDestination: new apigateway.LogGroupLogDestination(
          accessLogGroup,
        ),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
          caller: true,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true,
        }),
        methodOptions: {
          "/*/*": {
            throttlingRateLimit: 100, // 100 requests per second
            throttlingBurstLimit: 200, // 200 concurrent requests
          },
        },
      },
    });

    // Store API Gateway stage ARN and base URL
    this.stageARN_APIGW = this.api.deploymentStage.stageArn;
    this.apiGW_basedURL = this.api.urlForPath();

    // Create WAF Web ACL for API Gateway protection
    const waf = new wafv2.CfnWebACL(this, `${id}-waf`, {
      description: "WAF for API Gateway protection",
      scope: "REGIONAL", // Regional WAF for API Gateway
      defaultAction: { allow: {} }, // Allow requests by default
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: "DFO-firewall",
      },
      rules: [
        {
          // AWS managed rule set for common web exploits
          name: "AWS-AWSManagedRulesCommonRuleSet",
          priority: 1,
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesCommonRuleSet", // Protects against OWASP Top 10
            },
          },
          overrideAction: { none: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: "AWS-AWSManagedRulesCommonRuleSet",
          },
        },
        {
          // Rate limiting rule to prevent DDoS attacks from a single IP
          // Set to 2000 to balance shared network access and security
          name: "LimitRequests2000",
          priority: 2,
          action: {
            block: {},
          },
          statement: {
            rateBasedStatement: {
              limit: 2000,
              aggregateKeyType: "IP",
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: "LimitRequests2000",
          },
        },
        {
          // Per-user rate limiting (strict limit per authenticated identity)
          name: "PerUserRateLimit",
          priority: 3,
          action: {
            block: {},
          },
          statement: {
            rateBasedStatement: {
              limit: 200, // 200 requests per 5 minutes per user
              aggregateKeyType: "CUSTOM_KEYS",
              customKeys: [
                {
                  header: {
                    name: "Authorization",
                    textTransformations: [
                      {
                        priority: 0,
                        type: "MD5", // Use MD5 hash to handle long JWTs as unique keys
                      },
                    ],
                  },
                },
              ],
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: "PerUserRateLimit",
          },
        },
      ],
    });
    // Associate WAF with API Gateway stage
    const wafAssociation = new wafv2.CfnWebACLAssociation(
      this,
      `${id}-waf-association`,
      {
        resourceArn: `arn:aws:apigateway:${this.region}::/restapis/${this.api.restApiId}/stages/${this.api.deploymentStage.stageName}`,
        webAclArn: waf.attrArn,
      },
    );

    // Ensure API stage is created before WAF association
    wafAssociation.node.addDependency(this.api.deploymentStage);

    // Create IAM role for authenticated admin users
    const adminRole = new iam.Role(this, `${id}-AdminRole`, {
      assumedBy: new iam.FederatedPrincipal(
        "cognito-identity.amazonaws.com",
        {
          StringEquals: {
            "cognito-identity.amazonaws.com:aud": this.identityPool.ref,
          },
          "ForAnyValue:StringLike": {
            "cognito-identity.amazonaws.com:amr": "authenticated", // Only authenticated users
          },
        },
        "sts:AssumeRoleWithWebIdentity",
      ),
    });

    const studentRole = new iam.Role(this, `${id}-StudentRole`, {
      assumedBy: new iam.FederatedPrincipal(
        "cognito-identity.amazonaws.com",
        {
          StringEquals: {
            "cognito-identity.amazonaws.com:aud": this.identityPool.ref,
          },
          "ForAnyValue:StringLike": {
            "cognito-identity.amazonaws.com:amr": "authenticated", // Only authenticated users
          },
        },
        "sts:AssumeRoleWithWebIdentity",
      ),
    });

    const instructorRole = new iam.Role(this, `${id}-InstructorRole`, {
      assumedBy: new iam.FederatedPrincipal(
        "cognito-identity.amazonaws.com",
        {
          StringEquals: {
            "cognito-identity.amazonaws.com:aud": this.identityPool.ref,
          },
          "ForAnyValue:StringLike": {
            "cognito-identity.amazonaws.com:amr": "authenticated", // Only authenticated users
          },
        },
        "sts:AssumeRoleWithWebIdentity",
      ),
    });

    // Grant admin role permissions to invoke API Gateway endpoints
    adminRole.attachInlinePolicy(
      new iam.Policy(this, `${id}-AdminPolicy`, {
        statements: [
          createPolicyStatement(
            ["execute-api:Invoke"],
            [
              `arn:aws:execute-api:${this.region}:${this.account}:${this.api.restApiId}/*/*/admin/*`,
              `arn:aws:execute-api:${this.region}:${this.account}:${this.api.restApiId}/*/*/instructor/*`,
              `arn:aws:execute-api:${this.region}:${this.account}:${this.api.restApiId}/*/*/student/*`,
            ],
          ),
        ],
      }),
    );

    // Grant instructor role permissions to invoke API Gateway endpoints
    instructorRole.attachInlinePolicy(
      new iam.Policy(this, `${id}-InstructorPolicy`, {
        statements: [
          createPolicyStatement(
            ["execute-api:Invoke"],
            [
              `arn:aws:execute-api:${this.region}:${this.account}:${this.api.restApiId}/*/*/instructor/*`,
            ],
          ),
        ],
      }),
    );

    // Grant student role permissions to invoke API Gateway endpoints
    studentRole.attachInlinePolicy(
      new iam.Policy(this, `${id}-StudentPolicy`, {
        statements: [
          createPolicyStatement(
            ["execute-api:Invoke"],
            [
              `arn:aws:execute-api:${this.region}:${this.account}:${this.api.restApiId}/*/*/student/*`,
            ],
          ),
        ],
      }),
    );

    // Create admin user group in Cognito
    const adminGroup = new cognito.CfnUserPoolGroup(this, `${id}-AdminGroup`, {
      groupName: "admin",
      userPoolId: this.userPool.userPoolId,
      roleArn: adminRole.roleArn,
    });

    // Create instructor user group in Cognito
    const instructorGroup = new cognito.CfnUserPoolGroup(
      this,
      `${id}-InstructorGroup`,
      {
        groupName: "instructor",
        userPoolId: this.userPool.userPoolId,
        roleArn: instructorRole.roleArn,
      },
    );

    // Create student user group in Cognito
    const studentGroup = new cognito.CfnUserPoolGroup(
      this,
      `${id}-StudentGroup`,
      {
        groupName: "student",
        userPoolId: this.userPool.userPoolId,
        roleArn: studentRole.roleArn,
      },
    );

    // Create IAM role for Lambda functions that access PostgreSQL
    const lambdaRole = new iam.Role(this, `${id}-postgresLambdaRole`, {
      roleName: `${id}-postgresLambdaRole`,
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
    });

    // Grant Lambda permission to read specific Cognito secrets from Secrets Manager
    this.secret.grantRead(lambdaRole);

    // Grant Lambda permissions to read database secrets
    db.secretPathUser.grantRead(lambdaRole);
    db.secretPathTableCreator.grantRead(lambdaRole);

    // Grant Lambda VPC networking permissions
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "ec2:CreateNetworkInterface", // Create ENI for VPC access
          "ec2:DescribeNetworkInterfaces", // Query ENI status
          "ec2:DeleteNetworkInterface", // Clean up ENI
          "ec2:AssignPrivateIpAddresses", // Assign private IPs
          "ec2:UnassignPrivateIpAddresses", // Release private IPs
        ],
        resources: ["*"], // EC2 network actions require wildcard
      }),
    );

    // Grant Lambda CloudWatch logging permissions
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "logs:CreateLogGroup", // Create log groups
          "logs:CreateLogStream", // Create log streams
          "logs:PutLogEvents", // Write log events
        ],
        resources: ["arn:aws:logs:*:*:*"],
      }),
    );

    // Grant Lambda permissions to manage Cognito user groups
    const adminAddUserToGroupPolicyLambda = new iam.Policy(
      this,
      `${id}-adminAddUserToGroupPolicyLambda`,
      {
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
              "cognito-idp:AdminAddUserToGroup", // Add users to groups
              "cognito-idp:AdminRemoveUserFromGroup", // Remove users from groups
              "cognito-idp:AdminGetUser", // Get user details
              "cognito-idp:AdminListGroupsForUser", // List user's groups
            ],
            resources: [
              `arn:aws:cognito-idp:${this.region}:${this.account}:userpool/${this.userPool.userPoolId}`,
            ],
          }),
        ],
      },
    );
    lambdaRole.attachInlinePolicy(adminAddUserToGroupPolicyLambda);

    // Attach IAM roles to identity pool with role mapping based on Cognito groups
    new cognito.CfnIdentityPoolRoleAttachment(this, `${id}-IdentityPoolRoles`, {
      identityPoolId: this.identityPool.ref,
      roles: {
        authenticated: studentRole.roleArn, // Default role for authenticated users
      },
    });

    // Create Lambda authorizer function for admin endpoints
    // Validates JWT tokens and ensures user belongs to 'admin' group
    const adminAuthorizationFunction = new lambda.Function(
      this,
      `${id}-admin-authorization-api-gateway`,
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        code: lambda.Code.fromAsset("lambda/adminAuthorizerFunction"),
        handler: "adminAuthorizerFunction.handler",
        timeout: Duration.seconds(300),
        vpc: vpcStack.vpc, // VPC access for database connectivity if needed
        environment: {
          SM_COGNITO_CREDENTIALS: this.secret.secretName, // Cognito config from Secrets Manager
        },
        functionName: `${id}-adminLambdaAuthorizer`,
        memorySize: 512,
        layers: [jwt], // JWT verification library
        role: lambdaRole,
      },
    );

    // Grant API Gateway permission to invoke the admin authorizer
    adminAuthorizationFunction.grantInvoke(
      new iam.ServicePrincipal("apigateway.amazonaws.com"),
    );

    // Override logical ID to match OpenAPI specification reference
    const apiGW_adminAuthorizationFunction = adminAuthorizationFunction.node
      .defaultChild as lambda.CfnFunction;
    apiGW_adminAuthorizationFunction.overrideLogicalId("adminLambdaAuthorizer");

    // Create Lambda authorizer function for student endpoints
    // Validates JWT tokens and ensures user belongs to 'student', 'instructor', or 'admin' group
    const studentAuthFunction = new lambda.Function(
      this,
      `${id}-student-authorization-api-gateway`,
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        code: lambda.Code.fromAsset("lambda/studentAuthorizerFunction"),
        handler: "studentAuthorizerFunction.handler",
        timeout: Duration.seconds(300),
        vpc: vpcStack.vpc, // VPC access for database connectivity if needed
        memorySize: 512, // Lower memory since no VPC overhead
        layers: [jwt], // JWT verification library
        role: lambdaRole,
        environment: {
          SM_COGNITO_CREDENTIALS: this.secret.secretName, // Cognito config from Secrets Manager
        },
        functionName: `${id}-studentLambdaAuthorizer`,
      },
    );

    // Grant API Gateway permission to invoke the student authorizer
    studentAuthFunction.grantInvoke(
      new iam.ServicePrincipal("apigateway.amazonaws.com"),
    );

    // Override logical ID to match OpenAPI specification reference
    const apiGW_studentauthorizationFunction = studentAuthFunction.node
      .defaultChild as lambda.CfnFunction;
    apiGW_studentauthorizationFunction.overrideLogicalId(
      "studentLambdaAuthorizer",
    );

    // Create Lambda authorizer function for instructor endpoints
    // Validates JWT tokens and ensures user belongs to 'instructor' or 'admin' group
    const instructorAuthFunction = new lambda.Function(
      this,
      `${id}-instructor-authorization-api-gateway`,
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        code: lambda.Code.fromAsset("lambda/instructorAuthorizerFunction"),
        handler: "instructorAuthorizerFunction.handler",
        timeout: Duration.seconds(300),
        vpc: vpcStack.vpc,
        memorySize: 512, // Lower memory since no VPC overhead
        layers: [jwt], // JWT verification library
        role: lambdaRole,
        environment: {
          SM_COGNITO_CREDENTIALS: this.secret.secretName, // Cognito config from Secrets Manager
        },
        functionName: `${id}-instructorLambdaAuthorizer`,
      },
    );

    // Grant API Gateway permission to invoke the instructor authorizer
    instructorAuthFunction.grantInvoke(
      new iam.ServicePrincipal("apigateway.amazonaws.com"),
    );

    // Override logical ID to match OpenAPI specification reference
    const apiGW_instructorAuthorizationFunction = instructorAuthFunction.node
      .defaultChild as lambda.CfnFunction;
    apiGW_instructorAuthorizationFunction.overrideLogicalId(
      "instructorLambdaAuthorizer",
    );

    // create new cognito lambda role for cognito triggers
    const cognitoRole = new iam.Role(this, `${id}-CognitoLambdaRole`, {
      roleName: `${id}-CognitoLambdaRole`,
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
    });

    // Grant access to specific database secret (Application User)
    db.secretPathUser.grantRead(cognitoRole);

    // Grant permission to add users to an IAM group
    cognitoRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["iam:AddUserToGroup"],
        resources: [
          `arn:aws:iam::${this.account}:user/*`,
          `arn:aws:iam::${this.account}:group/*`,
        ],
      }),
    );

    // Grant access to EC2
    cognitoRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface",
          "ec2:AssignPrivateIpAddresses",
          "ec2:UnassignPrivateIpAddresses",
        ],
        resources: ["*"], // must be *
      }),
    );

    // Grant access to log
    cognitoRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          //Logs
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ],
        resources: ["arn:aws:logs:*:*:*"],
      }),
    );

    // Policy to allow Cognito admin actions for user group management
    const adminAddUserToGroupPolicy = new iam.Policy(
      this,
      `${id}-AdminAddUserToGroupPolicy`,
      {
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
              "cognito-idp:AdminAddUserToGroup",
              "cognito-idp:AdminRemoveUserFromGroup",
              "cognito-idp:AdminGetUser",
              "cognito-idp:AdminListGroupsForUser",
            ],
            resources: [
              `arn:aws:cognito-idp:${this.region}:${this.account}:userpool/${this.userPool.userPoolId}`,
            ],
          }),
        ],
      },
    );
    // Attach the inline policy to the role
    cognitoRole.attachInlinePolicy(adminAddUserToGroupPolicy);

    // Grant access to SSM parameters for allowed email domains
    cognitoRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/*`],
      }),
    );

    // Cognito Pre-Signup Lambda Trigger
    // Validates email domains and prevents unauthorized registrations
    // Cognito Pre-Signup Lambda Trigger
    // Validates email domains and prevents unauthorized registrations
    const preSignupLambda = new lambda.Function(this, "PreSignupLambda", {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "preSignup.handler",
      code: lambda.Code.fromAsset("lambda/authorization"),
      timeout: Duration.seconds(30),
      vpc: vpcStack.vpc,
      environment: {
        ALLOWED_EMAIL_DOMAINS: "/LAIGO/AllowedEmailDomains", // SSM parameter with allowed domains
      },
      functionName: `${id}-preSignupLambda`,
      memorySize: 128,
      role: cognitoRole,
    });

    // Cognito Post-Confirmation Lambda Trigger
    // Creates user record in database after email verification
    const postConfirmationLambda = new lambda.Function(
      this,
      "PostConfirmationLambda",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: "addStudentOnSignUp.handler",
        code: lambda.Code.fromAsset("lambda/authorization"),
        timeout: Duration.seconds(300),
        vpc: vpcStack.vpc, // VPC access for database connectivity
        environment: {
          SM_DB_CREDENTIALS: db.secretPathUser.secretName, // Database user credentials
          RDS_PROXY_ENDPOINT: db.rdsProxyEndpoint, // RDS Proxy for connection pooling
        },
        functionName: `${id}-addStudentOnSignUp`,
        memorySize: 128,
        layers: [postgres],
        role: cognitoRole,
      },
    );

    // Cognito Pre-Token Generation Lambda Trigger
    // Adjusts user roles and adds custom claims to JWT tokens based on database records
    const preTokenGenerationLambda = new lambda.Function(
      this,
      "PreTokenGenerationLambda",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: "adjustUserRoles.handler",
        timeout: Duration.seconds(300),
        code: lambda.Code.fromAsset("lambda/authorization"),
        vpc: vpcStack.vpc, // VPC access for database connectivity
        environment: {
          SM_DB_CREDENTIALS: db.secretPathUser.secretName, // Database user credentials
          RDS_PROXY_ENDPOINT: db.rdsProxyEndpoint, // RDS Proxy for connection pooling
        },
        functionName: `${id}-adjustUserRoles`,
        memorySize: 512,
        layers: [postgres],
        role: cognitoRole,
      },
    );

    // Attach Lambda triggers to Cognito User Pool lifecycle events
    this.userPool.addTrigger(
      cognito.UserPoolOperation.PRE_SIGN_UP, // Triggered before user registration
      preSignupLambda,
    );
    this.userPool.addTrigger(
      cognito.UserPoolOperation.POST_CONFIRMATION, // Triggered after email verification
      postConfirmationLambda,
    );
    this.userPool.addTrigger(
      cognito.UserPoolOperation.PRE_TOKEN_GENERATION, // Triggered before JWT token creation
      preTokenGenerationLambda,
    );
    // Create parameters for Bedrock LLM ID, Embedding Model ID, and Table Name in Parameter Store
    const bedrockLLMParameter = new ssm.StringParameter(
      this,
      "BedrockLLMParameter",
      {
        parameterName: `/${id}/LAIGO/BedrockLLMId`,
        description: "Parameter containing the Bedrock LLM ID",
        stringValue: "meta.llama3-70b-instruct-v1:0",
      },
    );

    const embeddingModelParameter = new ssm.StringParameter(
      this,
      "EmbeddingModelParameter",
      {
        parameterName: `/${id}/LAIGO/EmbeddingModelId`,
        description: "Parameter containing the Embedding Model ID",
        stringValue: "amazon.titan-embed-text-v2:0",
      },
    );

    const tableNameParameter = new ssm.StringParameter(
      this,
      "TableNameParameter",
      {
        parameterName: `/${id}/LAIGO/TableName`,
        description: "Parameter containing the DynamoDB table name",
        stringValue: "DynamoDB-Conversation-Table",
      },
    );

    const messageLimitParameter = new ssm.StringParameter(
      this,
      "MessageLimitParameter",
      {
        parameterName: `/${id}/LAIGO/MessageLimit`,
        description:
          "Parameter containing the Message Limit for the AI assistant (per day)",
        stringValue: "Infinity",
      },
    );

    // Create SSM parameter for file size limit
    const fileSizeLimitParameter = new ssm.StringParameter(
      this,
      "FileSizeLimitParameter",
      {
        parameterName: `/${id}/LAT/FileSizeLimit`,
        description:
          "Parameter containing the file size limit for audio uploads (in MB)",
        stringValue: "500",
      },
    );

    const bedrockTemperatureParameter = new ssm.StringParameter(
      this,
      "BedrockTemperatureParameter",
      {
        parameterName: `/${id}/LAIGO/BedrockTemperature`,
        description: "Parameter containing the Bedrock Temperature",
        stringValue: "0.5",
      },
    );

    const bedrockTopPParameter = new ssm.StringParameter(
      this,
      "BedrockTopPParameter",
      {
        parameterName: `/${id}/LAIGO/BedrockTopP`,
        description: "Parameter containing the Bedrock Top P",
        stringValue: "0.9",
      },
    );

    const bedrockMaxTokensParameter = new ssm.StringParameter(
      this,
      "BedrockMaxTokensParameter",
      {
        parameterName: `/${id}/LAIGO/BedrockMaxTokens`,
        description: "Parameter containing the Bedrock Max Tokens",
        stringValue: "2048",
      },
    );

    // ========================================
    // DynamoDB Tables
    // ========================================

    // Import existing conversation table
    const conversationTable = dynamodb.Table.fromTableName(
      this,
      "ConversationTable",
      "DynamoDB-Conversation-Table",
    );

    // Create playground conversation table
    const playgroundTable = new dynamodb.Table(this, `${id}-PlaygroundTable`, {
      tableName: "DynamoDB-Playground-Table",
      partitionKey: {
        name: "SessionId",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "ttl",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create notification table for storing user notifications
    const notificationTable = new dynamodb.Table(
      this,
      `${id}-NotificationTable`,
      {
        tableName: `${id}-notifications`,
        partitionKey: {
          name: "PK",
          type: dynamodb.AttributeType.STRING,
        },
        sortKey: {
          name: "SK",
          type: dynamodb.AttributeType.STRING,
        },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        timeToLiveAttribute: "ttl",
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      },
    );

    // Add GSI for notification lookup by notification ID
    notificationTable.addGlobalSecondaryIndex({
      indexName: "GSI1",
      partitionKey: {
        name: "GSI1PK",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "GSI1SK",
        type: dynamodb.AttributeType.STRING,
      },
    });

    // Create connection tracking table for WebSocket connections
    const connectionTable = new dynamodb.Table(this, `${id}-ConnectionTable`, {
      tableName: `${id}-connections`,
      partitionKey: {
        name: "PK",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "SK",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "ttl",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for connection lookup by user ID
    connectionTable.addGlobalSecondaryIndex({
      indexName: "GSI1",
      partitionKey: {
        name: "GSI1PK",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "GSI1SK",
        type: dynamodb.AttributeType.STRING,
      },
    });

    // --- Student Cases Lambda (GET /student/cases) ---
    // Defined early so other constructs can reference it
    const notificationEventBus = new events.EventBus(
      this,
      `${id}-NotificationEventBus`,
      {
        eventBusName: `${id}-notifications`,
      },
    );

    const lambdaStudentFunction = new lambda.Function(
      this,
      `${id}-studentFunction`,
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: "studentFunction.handler",
        code: lambda.Code.fromAsset("lambda/handlers"),
        timeout: Duration.seconds(30),
        vpc: vpcStack.vpc,
        environment: {
          SM_DB_CREDENTIALS: db.secretPathUser.secretName,
          RDS_PROXY_ENDPOINT: db.rdsProxyEndpoint,
          USER_POOL: this.userPool.userPoolId,
          MESSAGE_LIMIT: messageLimitParameter.parameterName,
          FILE_SIZE_LIMIT: fileSizeLimitParameter.parameterName,
          NOTIFICATION_EVENT_BUS_NAME: notificationEventBus.eventBusName,
        },
        functionName: `${id}-studentFunction`,
        memorySize: 512,
        layers: [postgres],
        role: lambdaRole,
      },
    );

    // Allow access to DynamoDB Table for reading chat history
    conversationTable.grantReadData(lambdaStudentFunction);

    // Grant EventBridge permissions for notification publishing
    lambdaStudentFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["events:PutEvents"],
        resources: [notificationEventBus.eventBusArn],
      }),
    );

    // Allow API Gateway to invoke the student cases lambda
    lambdaStudentFunction.grantInvoke(
      new iam.ServicePrincipal("apigateway.amazonaws.com"),
    );
    messageLimitParameter.grantRead(lambdaStudentFunction);
    fileSizeLimitParameter.grantRead(lambdaStudentFunction);

    // Override logical ID to reference from OpenAPI document
    const apiGW_studentCasesFunction = lambdaStudentFunction.node
      .defaultChild as lambda.CfnFunction;
    apiGW_studentCasesFunction.overrideLogicalId("studentFunction");

    const lambdaAdminFunction = new lambda.Function(
      this,
      `${id}-adminFunction`,
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        code: lambda.Code.fromAsset("lambda/handlers"),
        handler: "adminFunction.handler",
        timeout: Duration.seconds(300),
        vpc: vpcStack.vpc,
        environment: {
          SM_DB_CREDENTIALS: db.secretPathTableCreator.secretName,
          RDS_PROXY_ENDPOINT: db.rdsProxyEndpoint,
          MESSAGE_LIMIT: messageLimitParameter.parameterName,
          FILE_SIZE_LIMIT: fileSizeLimitParameter.parameterName,
          USER_POOL_ID: this.userPool.userPoolId,
          BEDROCK_TEMP_PARAM: bedrockTemperatureParameter.parameterName,
          BEDROCK_TOP_P_PARAM: bedrockTopPParameter.parameterName,
          BEDROCK_MAX_TOKENS_PARAM: bedrockMaxTokensParameter.parameterName,
          BEDROCK_LLM_PARAM: bedrockLLMParameter.parameterName,
        },
        functionName: `${id}-adminFunction`,
        memorySize: 512,
        layers: [postgres],
        role: lambdaRole,
      },
    );

    // Add the permission to the Lambda function's policy to allow API Gateway access
    lambdaAdminFunction.addPermission("AllowApiGatewayInvoke", {
      principal: new iam.ServicePrincipal("apigateway.amazonaws.com"),
      action: "lambda:InvokeFunction",
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${this.api.restApiId}/*/*/admin*`,
    });

    // Allow access for lambda to read and write to message limit parameter
    messageLimitParameter.grantWrite(lambdaAdminFunction);

    // Allow access for lambda to read and write to file size limit parameter
    fileSizeLimitParameter.grantWrite(lambdaAdminFunction);
    fileSizeLimitParameter.grantRead(lambdaAdminFunction);

    // Allow access for lambda to read and write to bedrock parameters
    bedrockTemperatureParameter.grantRead(lambdaAdminFunction);
    bedrockTemperatureParameter.grantWrite(lambdaAdminFunction);
    bedrockTopPParameter.grantRead(lambdaAdminFunction);
    bedrockTopPParameter.grantWrite(lambdaAdminFunction);
    bedrockMaxTokensParameter.grantRead(lambdaAdminFunction);
    bedrockMaxTokensParameter.grantWrite(lambdaAdminFunction);
    bedrockLLMParameter.grantRead(lambdaAdminFunction);
    bedrockLLMParameter.grantWrite(lambdaAdminFunction);

    const cfnLambda_Admin = lambdaAdminFunction.node
      .defaultChild as lambda.CfnFunction;
    cfnLambda_Admin.overrideLogicalId("adminFunction");

    // --- Instructor Lambda Function ---
    const lambdaInstructorFunction = new lambda.Function(
      this,
      `${id}-instructorFunction`,
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        code: lambda.Code.fromAsset("lambda/handlers"),
        handler: "instructorFunction.handler",
        timeout: Duration.seconds(300),
        vpc: vpcStack.vpc,
        environment: {
          SM_DB_CREDENTIALS: db.secretPathUser.secretName,
          RDS_PROXY_ENDPOINT: db.rdsProxyEndpoint,
          USER_POOL: this.userPool.userPoolId,
          MESSAGE_LIMIT: messageLimitParameter.parameterName,
          FILE_SIZE_LIMIT: fileSizeLimitParameter.parameterName,
        },
        functionName: `${id}-instructorFunction`,
        memorySize: 512,
        layers: [postgres],
        role: lambdaRole,
      },
    );

    // Add the permission to the Lambda function's policy to allow API Gateway access
    lambdaInstructorFunction.addPermission("AllowApiGatewayInvoke", {
      principal: new iam.ServicePrincipal("apigateway.amazonaws.com"),
      action: "lambda:InvokeFunction",
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${this.api.restApiId}/*/*/instructor*`,
    });

    // Allow access for lambda to read message limit parameter
    messageLimitParameter.grantRead(lambdaInstructorFunction);

    // Allow access for lambda to read file size limit parameter
    fileSizeLimitParameter.grantRead(lambdaInstructorFunction);

    // Override logical ID to reference from OpenAPI document
    const cfnLambda_Instructor = lambdaInstructorFunction.node
      .defaultChild as lambda.CfnFunction;
    cfnLambda_Instructor.overrideLogicalId("instructorFunction");

    const bedrockPolicyStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
      resources: [
        `arn:aws:bedrock:${this.region}::foundation-model/meta.llama3-70b-instruct-v1`,
        `arn:aws:bedrock:${this.region}::foundation-model/meta.llama3-70b-instruct-v1:0`, // Explicitly add the versioned model
        `arn:aws:bedrock:${this.region}::foundation-model/amazon.titan-embed-text-v2:0`, // If using Titan
        `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0`, // Add Claude 3 Sonnet
      ],
    });

    const caseGenLambdaDockerFunc = new lambda.DockerImageFunction(
      this,
      `${id}-CaseLambdaDockerFunction`,
      {
        code: lambda.DockerImageCode.fromEcr(
          props.ecrRepositories["caseGeneration"],
          {
            tagOrDigest: "latest", // or whatever tag you're using
          },
        ),
        memorySize: 512,
        timeout: cdk.Duration.seconds(300),
        vpc: vpcStack.vpc,
        functionName: `${id}-CaseLambdaDockerFunction`,
        environment: {
          SM_DB_CREDENTIALS: db.secretPathUser.secretName,
          RDS_PROXY_ENDPOINT: db.rdsProxyEndpoint,
          REGION: this.region,
          BEDROCK_LLM_PARAM: bedrockLLMParameter.parameterName,
          EMBEDDING_MODEL_PARAM: embeddingModelParameter.parameterName,
          TABLE_NAME_PARAM: tableNameParameter.parameterName,
          BEDROCK_TEMP_PARAM: bedrockTemperatureParameter.parameterName,
          BEDROCK_TOP_P_PARAM: bedrockTopPParameter.parameterName,
          BEDROCK_MAX_TOKENS_PARAM: bedrockMaxTokensParameter.parameterName,
          TABLE_NAME: "DynamoDB-Conversation-Table",
        },
      },
    );

    // Override the Logical ID of the Lambda Function to get ARN in OpenAPI
    const cfnCaseGenDockerFunc = caseGenLambdaDockerFunc.node
      .defaultChild as lambda.CfnFunction;
    cfnCaseGenDockerFunc.overrideLogicalId("CaseGenLambdaDockerFunc");

    // Add the permission to the Lambda function's policy to allow API Gateway access
    caseGenLambdaDockerFunc.addPermission("AllowApiGatewayInvoke", {
      principal: new iam.ServicePrincipal("apigateway.amazonaws.com"),
      action: "lambda:InvokeFunction",
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${this.api.restApiId}/*/*/student*`,
    });

    // Attach the corrected Bedrock policy to Lambda
    caseGenLambdaDockerFunc.addToRolePolicy(bedrockPolicyStatement);

    caseGenLambdaDockerFunc.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "bedrock:CreateGuardrail",
          "bedrock:CreateGuardrailVersion",
          "bedrock:DeleteGuardrail",
          "bedrock:ListGuardrails",
          "bedrock:InvokeGuardrail",
          "bedrock:ApplyGuardrail",
        ],
        resources: ["*"],
      }),
    );

    // Grant access to specific database secret
    db.secretPathUser.grantRead(caseGenLambdaDockerFunc);

    // Grant access to SSM Parameter Store for specific parameters
    caseGenLambdaDockerFunc.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["ssm:GetParameter"],
        resources: [
          bedrockLLMParameter.parameterArn,
          embeddingModelParameter.parameterArn,
          tableNameParameter.parameterArn,
          bedrockTemperatureParameter.parameterArn,
          bedrockTopPParameter.parameterArn,
          bedrockMaxTokensParameter.parameterArn,
        ],
      }),
    );

    const textGenLambdaDockerFunc = new lambda.DockerImageFunction(
      this,
      `${id}-TextGenLambdaDockerFunction`,
      {
        code: lambda.DockerImageCode.fromEcr(
          props.ecrRepositories["textGeneration"],
          {
            tagOrDigest: "latest", // or whatever tag you're using
          },
        ),
        memorySize: 512,
        timeout: cdk.Duration.seconds(300),
        vpc: vpcStack.vpc,
        functionName: `${id}-TextGenLambdaDockerFunction`,
        environment: {
          SM_DB_CREDENTIALS: db.secretPathUser.secretName,
          RDS_PROXY_ENDPOINT: db.rdsProxyEndpoint,
          REGION: this.region,
          BEDROCK_LLM_PARAM: bedrockLLMParameter.parameterName,
          EMBEDDING_MODEL_PARAM: embeddingModelParameter.parameterName,
          TABLE_NAME_PARAM: tableNameParameter.parameterName,
          BEDROCK_TEMP_PARAM: bedrockTemperatureParameter.parameterName,
          BEDROCK_TOP_P_PARAM: bedrockTopPParameter.parameterName,
          BEDROCK_MAX_TOKENS_PARAM: bedrockMaxTokensParameter.parameterName,
          MESSAGE_LIMIT_PARAM: messageLimitParameter.parameterName,
          TABLE_NAME: "DynamoDB-Conversation-Table",
        },
      },
    );

    // Override the Logical ID of the Lambda Function to get ARN in OpenAPI
    const cfnTextGenDockerFunc = textGenLambdaDockerFunc.node
      .defaultChild as lambda.CfnFunction;
    cfnTextGenDockerFunc.overrideLogicalId("TextGenLambdaDockerFunc");

    // Add the permission to the Lambda function's policy to allow API Gateway access
    textGenLambdaDockerFunc.addPermission("AllowApiGatewayInvoke", {
      principal: new iam.ServicePrincipal("apigateway.amazonaws.com"),
      action: "lambda:InvokeFunction",
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${this.api.restApiId}/*/*/student*`,
    });

    // Grant BedrockGuardrail access
    textGenLambdaDockerFunc.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "bedrock:CreateGuardrail",
          "bedrock:CreateGuardrailVersion",
          "bedrock:DeleteGuardrail",
          "bedrock:ListGuardrails",
          "bedrock:InvokeGuardrail",
          "bedrock:ApplyGuardrail",
        ],
        resources: ["*"],
      }),
    );

    // Attach the corrected Bedrock policy to Lambda
    textGenLambdaDockerFunc.addToRolePolicy(bedrockPolicyStatement);

    // Grant access to conversation table
    conversationTable.grantReadWriteData(textGenLambdaDockerFunc);

    // Grant access to specific database secret
    db.secretPathUser.grantRead(textGenLambdaDockerFunc);

    // Grant access to DynamoDB actions
    // ListTables requires wildcard resource
    textGenLambdaDockerFunc.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["dynamodb:ListTables"],
        resources: ["*"],
      }),
    );

    // Grant access to SSM Parameter Store for specific parameters
    textGenLambdaDockerFunc.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["ssm:GetParameter"],
        resources: [
          bedrockLLMParameter.parameterArn,
          embeddingModelParameter.parameterArn,
          tableNameParameter.parameterArn,
          bedrockTemperatureParameter.parameterArn,
          bedrockTopPParameter.parameterArn,
          bedrockMaxTokensParameter.parameterArn,
          messageLimitParameter.parameterArn,
        ],
      }),
    );

    // Create Lambda function for Playground text generation
    const playgroundGenLambdaDockerFunc = new lambda.DockerImageFunction(
      this,
      `${id}-PlaygroundTextGenLambdaDockerFunction`,
      {
        code: lambda.DockerImageCode.fromEcr(
          props.ecrRepositories["playgroundGeneration"],
          {
            tagOrDigest: "latest",
          },
        ),
        memorySize: 512,
        timeout: cdk.Duration.seconds(300),
        vpc: vpcStack.vpc,
        functionName: `${id}-PlaygroundTextGenLambdaDockerFunction`,
        environment: {
          SM_DB_CREDENTIALS: db.secretPathUser.secretName,
          RDS_PROXY_ENDPOINT: db.rdsProxyEndpoint,
          REGION: this.region,
          BEDROCK_LLM_PARAM: bedrockLLMParameter.parameterName,
          EMBEDDING_MODEL_PARAM: embeddingModelParameter.parameterName,
          TABLE_NAME_PARAM: tableNameParameter.parameterName, // Fallback/Reference
          BEDROCK_TEMP_PARAM: bedrockTemperatureParameter.parameterName,
          BEDROCK_TOP_P_PARAM: bedrockTopPParameter.parameterName,
          BEDROCK_MAX_TOKENS_PARAM: bedrockMaxTokensParameter.parameterName,
          TABLE_NAME: "DynamoDB-Playground-Table",
        },
      },
    );

    // Override the Logical ID
    const cfnPlaygroundGenDockerFunc = playgroundGenLambdaDockerFunc.node
      .defaultChild as lambda.CfnFunction;
    cfnPlaygroundGenDockerFunc.overrideLogicalId(
      "PlaygroundTextGenLambdaDockerFunc",
    );

    // Add permissions
    playgroundGenLambdaDockerFunc.addPermission("AllowApiGatewayInvoke", {
      principal: new iam.ServicePrincipal("apigateway.amazonaws.com"),
      action: "lambda:InvokeFunction",
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${this.api.restApiId}/*/*/student*`,
    });

    playgroundGenLambdaDockerFunc.addToRolePolicy(bedrockPolicyStatement);

    // Grant access to DynamoDB (Playground table access)
    playgroundTable.grantReadWriteData(playgroundGenLambdaDockerFunc);

    // Grant access to specific database secret
    db.secretPathUser.grantRead(playgroundGenLambdaDockerFunc);

    // Grant access to SSM Parameter Store
    playgroundGenLambdaDockerFunc.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["ssm:GetParameter"],
        resources: [
          bedrockLLMParameter.parameterArn,
          embeddingModelParameter.parameterArn,
          tableNameParameter.parameterArn,
          bedrockTemperatureParameter.parameterArn,
          bedrockTopPParameter.parameterArn,
          bedrockMaxTokensParameter.parameterArn,
        ],
      }),
    );

    // Ensure it can invoke the guardrail if needed (though we removed it from code, good to have if we re-add)
    playgroundGenLambdaDockerFunc.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "bedrock:CreateGuardrail",
          "bedrock:CreateGuardrailVersion",
          "bedrock:DeleteGuardrail",
          "bedrock:ListGuardrails",
          "bedrock:InvokeGuardrail",
          "bedrock:ApplyGuardrail",
        ],
        resources: ["*"],
      }),
    );

    // Create Lambda function for assessing user progress
    const assessProgressFunction = new lambda.DockerImageFunction(
      this,
      "AssessProgressFunction",
      {
        code: lambda.DockerImageCode.fromEcr(
          props.ecrRepositories["assessProgress"],
          {
            tagOrDigest: "latest", // or whatever tag you're using
          },
        ),
        functionName: `${id}-AssessProgressFunction`,
        timeout: Duration.seconds(300),
        memorySize: 1024,
        vpc: vpcStack.vpc,
        environment: {
          SM_DB_CREDENTIALS: db.secretPathUser.secretName,
          REGION: this.region,
          RDS_PROXY_ENDPOINT: db.rdsProxyEndpoint,
          BEDROCK_LLM_PARAM: bedrockLLMParameter.parameterName,
          EMBEDDING_MODEL_PARAM: embeddingModelParameter.parameterName,
          TABLE_NAME_PARAM: tableNameParameter.parameterName,
          BEDROCK_TEMP_PARAM: bedrockTemperatureParameter.parameterName,
          BEDROCK_TOP_P_PARAM: bedrockTopPParameter.parameterName,
          BEDROCK_MAX_TOKENS_PARAM: bedrockMaxTokensParameter.parameterName,
          TABLE_NAME: "DynamoDB-Conversation-Table",
          PLAYGROUND_TABLE_NAME: playgroundTable.tableName,
        },
      },
    );

    // Override Logical ID for OpenAPI reference
    const cfnAssessProgressFunction = assessProgressFunction.node
      .defaultChild as lambda.CfnFunction;
    cfnAssessProgressFunction.overrideLogicalId("AssessProgressFunction");

    // Allow API Gateway to invoke
    assessProgressFunction.addPermission("AllowApiGatewayInvoke", {
      principal: new iam.ServicePrincipal("apigateway.amazonaws.com"),
      action: "lambda:InvokeFunction",
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${this.api.restApiId}/*/*/student*`,
    });

    // Grant permissions to assessProgressFunction
    db.secretPathUser.grantRead(assessProgressFunction);
    playgroundTable.grantReadData(assessProgressFunction);
    assessProgressFunction.addToRolePolicy(bedrockPolicyStatement);

    assessProgressFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: [
          bedrockLLMParameter.parameterArn,
          embeddingModelParameter.parameterArn,
          tableNameParameter.parameterArn,
          bedrockTemperatureParameter.parameterArn,
          bedrockTopPParameter.parameterArn,
          bedrockMaxTokensParameter.parameterArn,
        ],
      }),
    );

    // Attach shared DynamoDB policy to assess progress lambda
    conversationTable.grantReadWriteData(assessProgressFunction);

    const audioStorageBucket = new s3.Bucket(
      this,
      `${id}-audio-prompt-bucket`,
      {
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        cors: [
          {
            allowedHeaders: ["*"],
            allowedMethods: [
              s3.HttpMethods.GET,
              s3.HttpMethods.PUT,
              s3.HttpMethods.HEAD,
              s3.HttpMethods.POST,
              s3.HttpMethods.DELETE,
            ],
            allowedOrigins: ["*"],
          },
        ],
        // When deleting the stack, the bucket will be deleted as well
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
        enforceSSL: true,
      },
    );

    const generatePreSignedURL = new lambda.Function(
      this,
      `${id}-GeneratePreSignedURLFunction`,
      {
        runtime: lambda.Runtime.PYTHON_3_11,
        code: lambda.Code.fromAsset("lambda/generatePreSignedURL"),
        handler: "generatePreSignedURL.lambda_handler",
        timeout: Duration.seconds(300),
        memorySize: 128,
        environment: {
          BUCKET: audioStorageBucket.bucketName,
          REGION: this.region,
        },
        functionName: `${id}-GeneratePreSignedURLFunction`,
        layers: [powertoolsLayer],
      },
    );

    // Override the Logical ID of the Lambda Function to get ARN in OpenAPI
    const cfnGeneratePreSignedURL = generatePreSignedURL.node
      .defaultChild as lambda.CfnFunction;
    cfnGeneratePreSignedURL.overrideLogicalId("GeneratePreSignedURLFunc");

    // Grant the Lambda function the necessary permissions
    audioStorageBucket.grantReadWrite(generatePreSignedURL);
    generatePreSignedURL.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:PutObject", "s3:GetObject"],
        resources: [
          audioStorageBucket.bucketArn,
          `${audioStorageBucket.bucketArn}/*`,
        ],
      }),
    );

    // Add the permission to the Lambda function's policy to allow API Gateway access
    generatePreSignedURL.addPermission("AllowApiGatewayInvoke", {
      principal: new iam.ServicePrincipal("apigateway.amazonaws.com"),
      action: "lambda:InvokeFunction",
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${this.api.restApiId}/*/*/student*`,
    });

    const audioToTextFunction = new lambda.DockerImageFunction(
      this,
      `${id}-audioToTextFunc`,
      {
        code: lambda.DockerImageCode.fromEcr(
          props.ecrRepositories["audioToText"],
          {
            tagOrDigest: "latest", // or whatever tag you're using
          },
        ),
        memorySize: 512,
        timeout: cdk.Duration.seconds(300),
        vpc: vpcStack.vpc,
        functionName: `${id}-audioToTextFunc`,
        environment: {
          AUDIO_BUCKET: audioStorageBucket.bucketName,
          SM_DB_CREDENTIALS: db.secretPathUser.secretName,
          RDS_PROXY_ENDPOINT: db.rdsProxyEndpoint,
          REGION: this.region,
        },
      },
    );

    const cfnAudioToTextFunction = audioToTextFunction.node
      .defaultChild as lambda.CfnFunction;
    cfnAudioToTextFunction.overrideLogicalId("audioToTextFunction");
    audioStorageBucket.grantRead(audioToTextFunction);

    audioToTextFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["s3:ListBucket"],
        resources: [audioStorageBucket.bucketArn],
      }),
    );

    audioToTextFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:HeadObject",
        ],
        resources: [`arn:aws:s3:::${audioStorageBucket.bucketName}/*`],
      }),
    );

    // Grant access to specific student database secret
    db.secretPathUser.grantRead(audioToTextFunction);

    audioToTextFunction.addPermission("AllowApiGatewayInvoke", {
      principal: new iam.ServicePrincipal("apigateway.amazonaws.com"),
      action: "lambda:InvokeFunction",
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${this.api.restApiId}/*/*/student*`,
    });

    audioToTextFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "transcribe:StartTranscriptionJob",
          "transcribe:GetTranscriptionJob",
          "transcribe:ListTranscriptionJobs",
        ],
        resources: [
          `arn:aws:transcribe:${this.region}:${this.account}:transcription-job/*`,
        ], // You can restrict this to specific resources if needed
      }),
    );

    // Grant EventBridge permissions for notification publishing
    audioToTextFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["events:PutEvents"],
        resources: [notificationEventBus.eventBusArn],
      }),
    );

    // Add EventBridge environment variable
    audioToTextFunction.addEnvironment(
      "NOTIFICATION_EVENT_BUS_NAME",
      notificationEventBus.eventBusName,
    );

    // Create Lambda function for generating case summaries
    const summaryGenerationFunction = new lambda.DockerImageFunction(
      this,
      "SummaryGenerationFunction",
      {
        code: lambda.DockerImageCode.fromEcr(
          props.ecrRepositories["summaryGeneration"],
          {
            tagOrDigest: "latest",
          },
        ),
        functionName: `${id}-SummaryGenerationFunction`,
        timeout: Duration.seconds(300),
        memorySize: 512,
        vpc: vpcStack.vpc,
        environment: {
          SM_DB_CREDENTIALS: db.secretPathUser.secretName,
          REGION: this.region,
          RDS_PROXY_ENDPOINT: db.rdsProxyEndpoint,
          BEDROCK_LLM_PARAM: bedrockLLMParameter.parameterName,
          TABLE_NAME_PARAM: tableNameParameter.parameterName,
          BEDROCK_TEMP_PARAM: bedrockTemperatureParameter.parameterName,
          BEDROCK_TOP_P_PARAM: bedrockTopPParameter.parameterName,
          BEDROCK_MAX_TOKENS_PARAM: bedrockMaxTokensParameter.parameterName,
          TABLE_NAME: "DynamoDB-Conversation-Table",
        },
      },
    );

    // Override Logical ID for OpenAPI reference
    const cfnSummaryGenerationFunction = summaryGenerationFunction.node
      .defaultChild as lambda.CfnFunction;
    cfnSummaryGenerationFunction.overrideLogicalId("SummaryGenerationFunction");

    // Allow API Gateway to invoke
    summaryGenerationFunction.addPermission("AllowApiGatewayInvoke", {
      principal: new iam.ServicePrincipal("apigateway.amazonaws.com"),
      action: "lambda:InvokeFunction",
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${this.api.restApiId}/*/*/student*`,
    });

    // Grant access to specific database secret
    db.secretPathUser.grantRead(summaryGenerationFunction);

    summaryGenerationFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: [
          bedrockLLMParameter.parameterArn,
          tableNameParameter.parameterArn,
          bedrockTemperatureParameter.parameterArn,
          bedrockTopPParameter.parameterArn,
          bedrockMaxTokensParameter.parameterArn,
        ],
      }),
    );

    // Attach shared DynamoDB policy to summary generation lambda
    conversationTable.grantReadWriteData(summaryGenerationFunction);

    // Grant access to Bedrock (using shared policy with specific model ARNs)
    summaryGenerationFunction.addToRolePolicy(bedrockPolicyStatement);

    // Grant EventBridge permissions for notification publishing
    summaryGenerationFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["events:PutEvents"],
        resources: [notificationEventBus.eventBusArn],
      }),
    );

    // Add EventBridge environment variable
    summaryGenerationFunction.addEnvironment(
      "NOTIFICATION_EVENT_BUS_NAME",
      notificationEventBus.eventBusName,
    );

    // Store table references for use by other constructs
    this.notificationTable = notificationTable;
    this.connectionTable = connectionTable;

    // ========================================
    // WebSocket API for Chat Streaming
    // ========================================

    // Lambda for $connect route - validates Cognito JWT tokens
    const wsConnectFunction = new lambda.Function(
      this,
      `${id}-WsConnectFunction`,
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        code: lambda.Code.fromAsset("lambda/websocket"),
        handler: "connect.handler",
        timeout: Duration.seconds(30),
        memorySize: 256,
        layers: [jwt],
        functionName: `${id}-WsConnect`,
        environment: {
          COGNITO_USER_POOL_ID: this.userPool.userPoolId,
          COGNITO_CLIENT_ID: this.appClient.userPoolClientId,
          CONNECTION_TABLE_NAME: connectionTable.tableName,
        },
      },
    );

    // Lambda for WebSocket Authorizer (validates token & returns IAM Policy)
    const wsAuthorizerFunction = new lambda.Function(
      this,
      `${id}-WsAuthorizerFunction`,
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        code: lambda.Code.fromAsset("lambda/websocket"),
        handler: "authorizer.handler",
        timeout: Duration.seconds(10),
        memorySize: 256,
        layers: [jwt],
        functionName: `${id}-WsAuthorizer`,
        environment: {
          COGNITO_USER_POOL_ID: this.userPool.userPoolId,
          COGNITO_CLIENT_ID: this.appClient.userPoolClientId,
        },
      },
    );

    // Lambda for $disconnect route - cleanup/logging
    const wsDisconnectFunction = new lambda.Function(
      this,
      `${id}-WsDisconnectFunction`,
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        code: lambda.Code.fromAsset("lambda/websocket"),
        handler: "disconnect.handler",
        timeout: Duration.seconds(10),
        memorySize: 128,
        functionName: `${id}-WsDisconnect`,
        environment: {
          CONNECTION_TABLE_NAME: connectionTable.tableName,
        },
      },
    );

    // Lambda for $default route - routes messages and invokes TextGen
    const wsDefaultFunction = new lambda.Function(
      this,
      `${id}-WsDefaultFunction`,
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        code: lambda.Code.fromAsset("lambda/websocket"),
        handler: "default.handler",
        timeout: Duration.seconds(30),
        memorySize: 256,
        functionName: `${id}-WsDefault`,
        environment: {
          TEXT_GEN_FUNCTION_NAME: textGenLambdaDockerFunc.functionName,
          ASSESS_PROGRESS_FUNCTION_NAME: assessProgressFunction.functionName,
          SUMMARY_GEN_FUNCTION_NAME: summaryGenerationFunction.functionName,
          AUDIO_TO_TEXT_FUNCTION_NAME: audioToTextFunction.functionName,
          PLAYGROUND_GEN_FUNCTION_NAME:
            playgroundGenLambdaDockerFunc.functionName,
        },
      },
    );

    // Grant default function permission to invoke TextGen, AssessProgress, SummaryGeneration, and AudioToText Lambdas
    textGenLambdaDockerFunc.grantInvoke(wsDefaultFunction);
    assessProgressFunction.grantInvoke(wsDefaultFunction);
    summaryGenerationFunction.grantInvoke(wsDefaultFunction);
    audioToTextFunction.grantInvoke(wsDefaultFunction);
    playgroundGenLambdaDockerFunc.grantInvoke(wsDefaultFunction);

    // Grant WebSocket functions permission to access DynamoDB connection table
    connectionTable.grantWriteData(wsConnectFunction);
    connectionTable.grantWriteData(wsDisconnectFunction);

    // Create Lambda Authorizer for WebSocket connections
    const wsAuthorizer = new WebSocketLambdaAuthorizer(
      `${id}-WsAuthorizer`,
      wsAuthorizerFunction,
      {
        identitySource: ["route.request.querystring.token"],
      },
    );

    // Create WebSocket API
    this.wsApi = new apigwv2.WebSocketApi(this, `${id}-ChatWebSocketApi`, {
      apiName: `${id}-ChatWebSocket`,
      connectRouteOptions: {
        integration: new WebSocketLambdaIntegration(
          "ConnectIntegration",
          wsConnectFunction,
        ),
        authorizer: wsAuthorizer,
      },
      disconnectRouteOptions: {
        integration: new WebSocketLambdaIntegration(
          "DisconnectIntegration",
          wsDisconnectFunction,
        ),
      },
      defaultRouteOptions: {
        integration: new WebSocketLambdaIntegration(
          "DefaultIntegration",
          wsDefaultFunction,
        ),
      },
    });

    // Create WebSocket Stage
    this.wsStage = new apigwv2.WebSocketStage(this, `${id}-WsStage`, {
      webSocketApi: this.wsApi,
      stageName: "prod",
      autoDeploy: true,
    });

    // Grant TextGen Lambda permission to post messages back to WebSocket connections
    textGenLambdaDockerFunc.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["execute-api:ManageConnections"],
        resources: [
          `arn:aws:execute-api:${this.region}:${this.account}:${this.wsApi.apiId}/${this.wsStage.stageName}/POST/@connections/*`,
        ],
      }),
    );

    // Add WebSocket endpoint to TextGen Lambda environment
    textGenLambdaDockerFunc.addEnvironment(
      "WEBSOCKET_API_ENDPOINT",
      this.wsStage.url.replace("wss://", "https://"),
    );

    // Grant default function permission to post back to connections (for pong)
    wsDefaultFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["execute-api:ManageConnections"],
        resources: [
          `arn:aws:execute-api:${this.region}:${this.account}:${this.wsApi.apiId}/${this.wsStage.stageName}/POST/@connections/*`,
        ],
      }),
    );

    // Grant AssessProgress Lambda permission to post messages back to WebSocket connections
    assessProgressFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["execute-api:ManageConnections"],
        resources: [
          `arn:aws:execute-api:${this.region}:${this.account}:${this.wsApi.apiId}/${this.wsStage.stageName}/POST/@connections/*`,
        ],
      }),
    );

    // Add WebSocket endpoint to AssessProgress Lambda environment
    assessProgressFunction.addEnvironment(
      "WEBSOCKET_API_ENDPOINT",
      this.wsStage.url.replace("wss://", "https://"),
    );

    // Grant SummaryGeneration Lambda permission to post messages back to WebSocket connections
    summaryGenerationFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["execute-api:ManageConnections"],
        resources: [
          `arn:aws:execute-api:${this.region}:${this.account}:${this.wsApi.apiId}/${this.wsStage.stageName}/POST/@connections/*`,
        ],
      }),
    );

    // Add WebSocket endpoint to SummaryGeneration Lambda environment
    summaryGenerationFunction.addEnvironment(
      "WEBSOCKET_API_ENDPOINT",
      this.wsStage.url.replace("wss://", "https://"),
    );

    // Grant AudioToText Lambda permission to post messages back to WebSocket connections
    audioToTextFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["execute-api:ManageConnections"],
        resources: [
          `arn:aws:execute-api:${this.region}:${this.account}:${this.wsApi.apiId}/${this.wsStage.stageName}/POST/@connections/*`,
        ],
      }),
    );

    // Add WebSocket endpoint to AudioToText Lambda environment
    audioToTextFunction.addEnvironment(
      "WEBSOCKET_API_ENDPOINT",
      this.wsStage.url.replace("wss://", "https://"),
    );

    // Grant PlaygroundGen Lambda permission to post messages back to WebSocket connections
    playgroundGenLambdaDockerFunc.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["execute-api:ManageConnections"],
        resources: [
          `arn:aws:execute-api:${this.region}:${this.account}:${this.wsApi.apiId}/${this.wsStage.stageName}/POST/@connections/*`,
        ],
      }),
    );

    // Add WebSocket endpoint to PlaygroundGen Lambda environment
    playgroundGenLambdaDockerFunc.addEnvironment(
      "WEBSOCKET_API_ENDPOINT",
      this.wsStage.url.replace("wss://", "https://"),
    );

    // ========================================
    // Notification Service (Lambda)
    // ========================================

    // Create notification service Lambda function
    const notificationServiceFunction = new lambda.Function(
      this,
      `${id}-NotificationService`,
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        code: lambda.Code.fromAsset("lambda/notificationService"),
        handler: "index.handler",
        timeout: Duration.seconds(30),
        memorySize: 512,
        functionName: `${id}-NotificationService`,
        environment: {
          NOTIFICATION_TABLE_NAME: notificationTable.tableName,
          CONNECTION_TABLE_NAME: connectionTable.tableName,
          WEBSOCKET_API_ENDPOINT: this.wsStage.url.replace(
            "wss://",
            "https://",
          ),
        },
      },
    );

    // Override Logical ID for OpenAPI reference
    const cfnNotificationServiceFunction = notificationServiceFunction.node
      .defaultChild as lambda.CfnFunction;
    cfnNotificationServiceFunction.overrideLogicalId(
      "notificationServiceFunction",
    );

    // Grant notification service permissions
    notificationTable.grantReadWriteData(notificationServiceFunction);
    connectionTable.grantReadData(notificationServiceFunction);

    // Grant WebSocket API permissions for notification delivery
    notificationServiceFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["execute-api:ManageConnections"],
        resources: [
          `arn:aws:execute-api:${this.region}:${this.account}:${this.wsApi.apiId}/${this.wsStage.stageName}/POST/@connections/*`,
        ],
      }),
    );

    // Create EventBridge rule for notification events
    const notificationRule = new events.Rule(this, `${id}-NotificationRule`, {
      eventBus: notificationEventBus,
      eventPattern: {
        source: ["notification.system"],
        detailType: [
          "Feedback Notification",
          "Summary Generation Complete",
          "Transcription Complete",
          "Case Submitted",
        ],
      },
      targets: [new targets.LambdaFunction(notificationServiceFunction)],
    });

    // Grant EventBridge permission to invoke notification service
    notificationServiceFunction.grantInvoke(
      new iam.ServicePrincipal("events.amazonaws.com"),
    );

    // Grant API Gateway permission to invoke the notification service
    notificationServiceFunction.grantInvoke(
      new iam.ServicePrincipal("apigateway.amazonaws.com"),
    );

    // Grant EventBridge permissions for instructor function feedback notifications
    lambdaInstructorFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["events:PutEvents"],
        resources: [notificationEventBus.eventBusArn],
      }),
    );

    // Add EventBridge environment variable to instructor function
    lambdaInstructorFunction.addEnvironment(
      "NOTIFICATION_EVENT_BUS_NAME",
      notificationEventBus.eventBusName,
    );

    // Store EventBridge bus reference for other constructs
    this.notificationEventBus = notificationEventBus;
  }
}
