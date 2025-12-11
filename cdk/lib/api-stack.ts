// AWS CDK core imports
import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as appsync from "aws-cdk-lib/aws-appsync";
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
  // AppSync GraphQL API for real-time events
  private eventApi: appsync.GraphqlApi;
  // Secrets Manager secret reference
  public readonly secret: secretsmanager.ISecret;
  // Getter methods for accessing stack resources
  public getEndpointUrl = () => this.api.url;
  public getUserPoolId = () => this.userPool.userPoolId;
  public getEventApiUrl = () => this.eventApi.graphqlUrl;
  public getUserPoolClientId = () => this.appClient.userPoolClientId;
  public getIdentityPoolId = () => this.identityPool.ref;
  public addLayer = (name: string, layer: lambda.ILayerVersion) =>
    (this.layerList[name] = layer);
  public getLayers = () => this.layerList;

  constructor(
    scope: Construct,
    id: string,
    db: DatabaseStack,
    vpcStack: VpcStack,
    props: ApiGatewayStackProps
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
      `arn:aws:lambda:${this.region}:017000801446:layer:AWSLambdaPowertoolsPythonV2:78`
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
        allowUnauthenticatedIdentities: true, // Allow unauthenticated access
        identityPoolName: `${id}IdentityPool`,
        cognitoIdentityProviders: [
          {
            clientId: this.appClient.userPoolClientId,
            providerName: this.userPool.userPoolProviderName,
          },
        ],
      }
    );

    // Store Cognito configuration in Secrets Manager for frontend application
    const secretsName = `${id}-LAIGO_Cognito_Secrets`;
    this.secret = new secretsmanager.Secret(this, secretsName, {
      secretName: secretsName,
      description: "Cognito Secrets for authentication",
      secretObjectValue: {
        VITE_COGNITO_USER_POOL_ID: cdk.SecretValue.unsafePlainText(
          this.userPool.userPoolId
        ),
        VITE_COGNITO_USER_POOL_CLIENT_ID: cdk.SecretValue.unsafePlainText(
          this.appClient.userPoolClientId
        ),
        VITE_AWS_REGION: cdk.SecretValue.unsafePlainText(
          this.region
        ),
        VITE_IDENTITY_POOL_ID: cdk.SecretValue.unsafePlainText(
          this.identityPool.ref
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
          accessLogGroup
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
          // Rate limiting rule to prevent DDoS attacks
          name: "LimitRequests1000",
          priority: 2,
          action: {
            block: {}, // Block requests exceeding limit
          },
          statement: {
            rateBasedStatement: {
              limit: 1000, // 1000 requests per 5 minutes per IP
              aggregateKeyType: "IP",
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: "LimitRequests1000",
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
      }
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
        "sts:AssumeRoleWithWebIdentity"
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
        "sts:AssumeRoleWithWebIdentity"
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
        "sts:AssumeRoleWithWebIdentity"
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
            ]
          ),
        ],
      })
    );

    // Grant instructor role permissions to invoke API Gateway endpoints
    instructorRole.attachInlinePolicy(
      new iam.Policy(this, `${id}-InstructorPolicy`, {
        statements: [
          createPolicyStatement(
            ["execute-api:Invoke"],
            [
              `arn:aws:execute-api:${this.region}:${this.account}:${this.api.restApiId}/*/*/instructor/*`,
            ]
          ),
        ],
      })
    );

    // Grant student role permissions to invoke API Gateway endpoints
    studentRole.attachInlinePolicy(
      new iam.Policy(this, `${id}-StudentPolicy`, {
        statements: [
          createPolicyStatement(
            ["execute-api:Invoke"],
            [
              `arn:aws:execute-api:${this.region}:${this.account}:${this.api.restApiId}/*/*/student/*`,
            ]
          ),
        ],
      })
    );

    // Create IAM role for unauthenticated users
    const unauthenticatedRole = new iam.Role(
      this,
      `${id}-UnauthenticatedRole`,
      {
        assumedBy: new iam.FederatedPrincipal(
          "cognito-identity.amazonaws.com",
          {
            StringEquals: {
              "cognito-identity.amazonaws.com:aud": this.identityPool.ref,
            },
            "ForAnyValue:StringLike": {
              "cognito-identity.amazonaws.com:amr": "unauthenticated", // Unauthenticated access
            },
          },
          "sts:AssumeRoleWithWebIdentity"
        ),
      }
    );

    // Create admin user group in Cognito
    const adminGroup = new cognito.CfnUserPoolGroup(this, `${id}-AdminGroup`, {
      groupName: "admin",
      userPoolId: this.userPool.userPoolId,
      roleArn: adminRole.roleArn,
    });

    // Create instructor user group in Cognito
    const instructorGroup = new cognito.CfnUserPoolGroup(this, `${id}-InstructorGroup`, {
      groupName: "instructor",
      userPoolId: this.userPool.userPoolId,
      roleArn: instructorRole.roleArn,
    });

    // Create student user group in Cognito
    const studentGroup = new cognito.CfnUserPoolGroup(this, `${id}-StudentGroup`, {
      groupName: "student",
      userPoolId: this.userPool.userPoolId,
      roleArn: studentRole.roleArn,
    });

    // Create IAM role for Lambda functions that access PostgreSQL
    const lambdaRole = new iam.Role(this, `${id}-postgresLambdaRole`, {
      roleName: `${id}-postgresLambdaRole`,
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
    });

    // Grant Lambda permission to read database credentials from Secrets Manager
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "secretsmanager:GetSecretValue", // Read secret values
        ],
        resources: [
          `arn:aws:secretsmanager:${this.region}:${this.account}:secret:*`,
        ],
      })
    );

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
      })
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
      })
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
      }
    );
    lambdaRole.attachInlinePolicy(adminAddUserToGroupPolicyLambda);

    // Attach IAM roles to identity pool with role mapping based on Cognito groups
    new cognito.CfnIdentityPoolRoleAttachment(this, `${id}-IdentityPoolRoles`, {
      identityPoolId: this.identityPool.ref,
      roles: {
        authenticated: studentRole.roleArn, // Default role for authenticated users
        unauthenticated: unauthenticatedRole.roleArn, // Role for unauthenticated users
      },
    });


    const adminAuthorizationFunction = new lambda.Function(
      this,
      `${id}-admin-authorization-api-gateway`,
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        code: lambda.Code.fromAsset("lambda/adminAuthorizerFunction"),
        handler: "adminAuthorizerFunction.handler",
        timeout: Duration.seconds(300),
        vpc: vpcStack.vpc,
        environment: {
          SM_COGNITO_CREDENTIALS: this.secret.secretName,
        },
        functionName: `${id}-adminLambdaAuthorizer`,
        memorySize: 512,
        layers: [jwt],
        role: lambdaRole,
      }
    );

    adminAuthorizationFunction.grantInvoke(
      new iam.ServicePrincipal("apigateway.amazonaws.com")
    );

    const apiGW_adminAuthorizationFunction = adminAuthorizationFunction.node
      .defaultChild as lambda.CfnFunction;
    apiGW_adminAuthorizationFunction.overrideLogicalId("adminLambdaAuthorizer");

    const studentAuthFunction = new lambda.Function(
      this,
      `${id}-student-authorization-api-gateway`,
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        code: lambda.Code.fromAsset("lambda/studentAuthorizerFunction"),
        handler: "studentAuthorizerFunction.handler",
        timeout: Duration.seconds(300),
        memorySize: 256,
        layers: [jwt],
        role: lambdaRole,
        environment: {
          SM_COGNITO_CREDENTIALS: this.secret.secretName,
        },
        functionName: `${id}-studentLambdaAuthorizer`,
      }
    );
    studentAuthFunction.grantInvoke(
      new iam.ServicePrincipal("apigateway.amazonaws.com")
    );

    const apiGW_studentauthorizationFunction = studentAuthFunction.node
      .defaultChild as lambda.CfnFunction;
    apiGW_studentauthorizationFunction.overrideLogicalId("studentLambdaAuthorizer");


    const instructorAuthFunction = new lambda.Function(
      this,
      `${id}-instructor-authorization-api-gateway`,
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        code: lambda.Code.fromAsset("lambda/instructorAuthorizerFunction"),
        handler: "instructorAuthorizerFunction.handler",
        timeout: Duration.seconds(300),
        memorySize: 256,
        layers: [jwt],
        role: lambdaRole,
        environment: {
          SM_COGNITO_CREDENTIALS: this.secret.secretName,
        },
        functionName: `${id}-instructorLambdaAuthorizer`,
      }
    );
    instructorAuthFunction.grantInvoke(
      new iam.ServicePrincipal("apigateway.amazonaws.com")
    );

    const apiGW_instructorAuthorizationFunction = instructorAuthFunction.node
      .defaultChild as lambda.CfnFunction;
    apiGW_instructorAuthorizationFunction.overrideLogicalId("instructorLambdaAuthorizer");
  }
}
