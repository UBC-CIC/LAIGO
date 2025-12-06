#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CdkStack } from '../lib/cdk-stack';
import { VpcStack } from '../lib/vpc-stack';
import { DatabaseStack } from '../lib/database-stack';
import { DBFlowStack } from '../lib/dbFlow-stack';

const app = new cdk.App();

// Parse params from command line 
const StackPrefix = app.node.tryGetContext('StackPrefix');
const version = app.node.tryGetContext('Version');
const githubRepo = app.node.tryGetContext('GithubRepo');

// grab account and region info 
const env: cdk.Environment = { 
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION 
};



const vpc = new VpcStack(app, `${StackPrefix}-VpcStack`, {env, stackPrefix: StackPrefix});
const db = new DatabaseStack(app, `${StackPrefix}-DatabaseStack`, vpc, {env});
const dbFlow = new DBFlowStack(app, `${StackPrefix}-DBFlowStack`, vpc, db, {env})

