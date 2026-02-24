import { Stack, StackProps, triggers } from "aws-cdk-lib";
import { Construct } from "constructs";
import { Duration } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { VpcStack } from "./vpc-stack";
import { DatabaseStack } from "./database-stack";

export class DBFlowStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    vpcStack: VpcStack,
    db: DatabaseStack,
    props?: StackProps,
  ) {
    super(scope, id, props);

    // Create IAM role for Lambda within the VPC
    const lambdaRole = new iam.Role(this, `${id}-lambda-vpc-role`, {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      description: "Role for all Lambda functions inside VPC",
    });

    // Grant permissions on specific database secrets
    db.secretPathAdmin.grantRead(lambdaRole);
    db.secretPathUser.grantRead(lambdaRole);
    db.secretPathUser.grantWrite(lambdaRole);
    db.secretPathTableCreator.grantRead(lambdaRole);
    db.secretPathTableCreator.grantWrite(lambdaRole);

    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          // CloudWatch Logs
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ],
        resources: ["arn:aws:logs:*:*:*"],
      }),
    );

    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["ec2:CreateNetworkInterface", "ec2:DeleteNetworkInterface"],
        resources: [
          `arn:aws:ec2:${this.region}:${this.account}:network-interface/*`,
          ...vpcStack.vpc.privateSubnets.map((subnet) => 
            `arn:aws:ec2:${this.region}:${this.account}:subnet/${subnet.subnetId}`
          ),
          ...vpcStack.vpc.isolatedSubnets.map((subnet) => 
            `arn:aws:ec2:${this.region}:${this.account}:subnet/${subnet.subnetId}`
          ),
          `arn:aws:ec2:${this.region}:${this.account}:security-group/${vpcStack.vpc.vpcDefaultSecurityGroup}`,
        ],
      }),
    );

    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["ec2:DescribeNetworkInterfaces"],
        resources: ["*"], // DescribeNetworkInterfaces does not support resource-level permissions
      }),
    );

    // Add additional managed policies
    lambdaRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMReadOnlyAccess"),
    );

    // Create a Lambda layer for node-pg-migrate
    const nodePgMigrateLayer = new lambda.LayerVersion(
      this,
      "nodePgMigrateLayer",
      {
        code: lambda.Code.fromAsset("./layers/node-pg-migrate.zip"),
        compatibleRuntimes: [lambda.Runtime.NODEJS_22_X],
        description: "Lambda layer with node-pg-migrate and pg",
      },
    );

    new triggers.TriggerFunction(this, `${id}-triggerLambda`, {
      description: `Database initializer and migration runner - ${new Date().toISOString()}`,
      functionName: `${id}-initializerFunction`,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      timeout: Duration.seconds(300),
      memorySize: 512,
      environment: {
        DB_SECRET_NAME: db.secretPathAdmin.secretName,
        DB_USER_SECRET_NAME: db.secretPathUser.secretName,
        DB_TABLE_CREATOR_SECRET_NAME: db.secretPathTableCreator.secretName,
      },
      vpc: db.dbInstance.vpc,
      code: lambda.Code.fromAsset("lambda/db_setup"),
      layers: [nodePgMigrateLayer],
      role: lambdaRole,
    });
  }
}
