#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { VpcStack } from "../lib/vpc-stack";
import { DatabaseStack } from "../lib/database-stack";
import { DBFlowStack } from "../lib/dbFlow-stack";
import { CICDStack } from "../lib/cicd-stack"
import { ApiGatewayStack } from "../lib/api-stack";
import { AmplifyStack } from "../lib/amplify-stack";

const app = new cdk.App();

// Parse params from command line with defaults
const StackPrefix = app.node.tryGetContext("StackPrefix");
const version = app.node.tryGetContext("Version");
const environment = app.node.tryGetContext("Environment");
const githubRepo = app.node.tryGetContext("GithubRepo");

// grab account and region info
const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const vpc = new VpcStack(app, `${StackPrefix}-VpcStack`, {
  env,
  stackPrefix: StackPrefix,
});

const db = new DatabaseStack(app, `${StackPrefix}-DatabaseStack`, vpc, { env });
// Ensure database waits for VPC
db.addDependency(vpc);

const dbFlow = new DBFlowStack(app, `${StackPrefix}-DBFlowStack`, vpc, db, {
  env,
});
// Ensure dbFlow waits for database
dbFlow.addDependency(db);

// const cicd = new CICDStack(app, `${StackPrefix}-CICDStack`, {
//   env,
//   githubRepo: githubRepo,
//   environmentName: environment,
//   lambdaFunctions: [
//     /* Example entry for additional Lambda functions and path filters
//     {
//       name: "dataIngestion",
//       functionName: `${StackPrefix}-Api-DataIngestionLambdaDockerFunc`,
//       sourceDir: "cdk/lambda/data_ingestion",
//       },*/
//   ],
//   pathFilters: [
//     //"cdk/lambda/data_ingestion/**",
//   ],
// });

const api = new ApiGatewayStack(app, `${StackPrefix}-ApiStack`, db, vpc, {
  env,
  ecrRepositories: {},
});
// Ensure API waits for database and dbFlow (change to CICD stack later)
api.addDependency(db);
api.addDependency(dbFlow);

const amplify = new AmplifyStack(app, `${StackPrefix}-AmplifyStack`, api, {
  env,
  githubRepo: githubRepo,
});
// Ensure Amplify waits for API
amplify.addDependency(api);
