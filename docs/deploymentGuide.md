# Deployment Guide

## Table of Contents

- [Deployment Guide](#deployment-guide)
  - [Table of Contents](#table-of-contents)
  - [Requirements](#requirements)
  - [Pre-Deployment](#pre-deployment)
    - [Create GitHub Personal Access Token](#create-github-personal-access-token)
    - [Enable Models in Bedrock](#enable-models-in-bedrock)
  - [Deployment](#deployment)
    - [Step 1: Fork \& Clone The Repository](#step-1-fork--clone-the-repository)
    - [Step 2: Upload Secrets](#step-2-upload-secrets)
    - [Step 3: CDK Deployment](#step-3-cdk-deployment)
  - [Post-Deployment](#post-deployment)
    - [Step 1: Build AWS Amplify App](#step-1-build-aws-amplify-app)
    - [Step 2: Visit Web App](#step-2-visit-web-app)
  - [Cleanup](#cleanup)
    - [Taking down the deployed stack](#taking-down-the-deployed-stack)

## Requirements

Before you deploy, ensure the following are available locally:

- [git](https://git-scm.com/downloads)
- [AWS Account](https://aws.amazon.com/account/)
- [GitHub Account](https://github.com/)
- [AWS CLI v2](https://aws.amazon.com/cli/)
- [Node.js](https://nodejs.org/en/download) _(20.x or newer recommended)_
- [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)
- [Docker](https://docs.docker.com/get-docker/) _(required for CDK asset bundling; Docker Desktop must be running in the background during first deployment)_

You also need AWS credentials configured (`aws configure` or SSO profile), and permissions to create IAM roles, VPC, RDS, API Gateway, Cognito, Lambda, Amplify, CodePipeline, CodeBuild, ECR, WAF, SSM, Secrets Manager, and CloudWatch resources.

## Pre-Deployment

### Create GitHub Personal Access Token

This deployment creates:

- an Amplify app connected to GitHub, and
- a CodePipeline source stage connected to GitHub.

You must create a GitHub personal access token (classic) with the `repo` scope. Follow GitHub instructions [here](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-personal-access-token-classic).

**Save the token value securely. You will upload it to AWS Secrets Manager in Step 2.**

### Enable Models in Bedrock

This project provisions Bedrock guardrails and invokes foundation models from Lambda. In Amazon Bedrock Model access, enable at least:

- `meta.llama3-70b-instruct-v1:0`
- `anthropic.claude-3-sonnet-20240229-v1:0`

If either model is not enabled in the deployment region, model invocation calls will fail at runtime.

## Deployment

### Step 1: Fork & Clone The Repository

First, fork the repository from the [main branch](https://github.com/UBC-CIC/Legal-Aid-Tool), then clone your fork:

```bash
git clone https://github.com/<YOUR-GITHUB-USERNAME>/Legal-Aid-Tool.git
cd Legal-Aid-Tool
```

#### Install Dependencies

Install dependencies for both CDK infrastructure and frontend build:

```bash
cd cdk
npm install
cd ../frontend
npm install
cd ../cdk
```

### Step 2: Upload Secrets

The current CDK code expects exact secret/parameter names and keys. Use the exact values below.

For every command in this section:

- Keep fixed names exactly as shown (for example `github-personal-access-token`, `laigo-owner-name`, `LAIGOSecrets`, `/LAIGO/AllowedEmailDomains`).
- Replace only values inside angled brackets (`<...>`) with your real values.

#### 1) GitHub token secret (required by Amplify + CodePipeline)

Create a secret named `github-personal-access-token` with JSON key `my-github-token`.

Before running the command, replace:

- `<YOUR-GITHUB-TOKEN>` with your actual GitHub Personal Access Token (classic) value.
- `<YOUR-PROFILE-NAME>` with your AWS CLI profile name.

<details>
<summary>macOS</summary>

```bash
aws secretsmanager create-secret \
    --name github-personal-access-token \
    --secret-string '{"my-github-token":"<YOUR-GITHUB-TOKEN>"}' \
    --profile <YOUR-PROFILE-NAME>
```

</details>

<details>
<summary>Windows CMD</summary>

```cmd
aws secretsmanager create-secret ^
    --name github-personal-access-token ^
    --secret-string "{\"my-github-token\":\"<YOUR-GITHUB-TOKEN>\"}" ^
    --profile <YOUR-PROFILE-NAME>
```

</details>

<details>
<summary>PowerShell</summary>

```powershell
aws secretsmanager create-secret `
    --name github-personal-access-token `
    --secret-string '{"my-github-token":"<YOUR-GITHUB-TOKEN>"}' `
    --profile <YOUR-PROFILE-NAME>
```

</details>

#### 2) GitHub owner SSM parameter (required by Amplify + CodePipeline)

Create SSM parameter `laigo-owner-name` with your GitHub username.

Before running the command, replace:

- `<YOUR-GITHUB-USERNAME>` with your GitHub username only (do not include `@`).
- `<YOUR-PROFILE-NAME>` with your AWS CLI profile name.

<details>
<summary>macOS</summary>

```bash
aws ssm put-parameter \
    --name "laigo-owner-name" \
    --value "<YOUR-GITHUB-USERNAME>" \
    --type String \
    --profile <YOUR-PROFILE-NAME>
```

</details>

<details>
<summary>Windows CMD</summary>

```cmd
aws ssm put-parameter ^
    --name "laigo-owner-name" ^
    --value "<YOUR-GITHUB-USERNAME>" ^
    --type String ^
    --profile <YOUR-PROFILE-NAME>
```

</details>

<details>
<summary>PowerShell</summary>

```powershell
aws ssm put-parameter `
    --name "laigo-owner-name" `
    --value "<YOUR-GITHUB-USERNAME>" `
    --type String `
    --profile <YOUR-PROFILE-NAME>
```

</details>

#### 3) Database bootstrap secret (required by Database stack)

Create a secret named `LAIGOSecrets` with JSON key `DB_Username`.

Before running the command, replace:

- `<YOUR-DB-USERNAME>` with the database admin username you want to use for this deployment.
- `<YOUR-PROFILE-NAME>` with your AWS CLI profile name.

<details>
<summary>macOS</summary>

```bash
aws secretsmanager create-secret \
    --name LAIGOSecrets \
    --secret-string '{"DB_Username":"<YOUR-DB-USERNAME>"}' \
    --profile <YOUR-PROFILE-NAME>
```

</details>

<details>
<summary>Windows CMD</summary>

```cmd
aws secretsmanager create-secret ^
    --name LAIGOSecrets ^
    --secret-string "{\"DB_Username\":\"<YOUR-DB-USERNAME>\"}" ^
    --profile <YOUR-PROFILE-NAME>
```

</details>

<details>
<summary>PowerShell</summary>

```powershell
aws secretsmanager create-secret `
    --name LAIGOSecrets `
    --secret-string '{"DB_Username":"<YOUR-DB-USERNAME>"}' `
    --profile <YOUR-PROFILE-NAME>
```

</details>

For example:

```bash
aws secretsmanager create-secret --name LAIGOSecrets --secret-string '{"DB_Username":"LAIGODatabaseUser"}' --profile <YOUR-PROFILE-NAME>
```

#### 4) Allowed signup domains (required by Cognito pre-signup Lambda)

Create secure SSM parameter `/LAIGO/AllowedEmailDomains` with a comma-separated domain list.

Before running the command, replace:

- `<YOUR-ALLOWED-EMAIL-DOMAIN-LIST>` with a comma-separated list like `example.com,school.edu`.
- `<YOUR-PROFILE-NAME>` with your AWS CLI profile name.

<details>
<summary>macOS</summary>

```bash
aws ssm put-parameter \
    --name "/LAIGO/AllowedEmailDomains" \
    --value "<YOUR-ALLOWED-EMAIL-DOMAIN-LIST>" \
    --type SecureString \
    --profile <YOUR-PROFILE-NAME>
```

</details>

<details>
<summary>Windows CMD</summary>

```cmd
aws ssm put-parameter ^
    --name "/LAIGO/AllowedEmailDomains" ^
    --value "<YOUR-ALLOWED-EMAIL-DOMAIN-LIST>" ^
    --type SecureString ^
    --profile <YOUR-PROFILE-NAME>
```

</details>

<details>
<summary>PowerShell</summary>

```powershell
aws ssm put-parameter `
    --name "/LAIGO/AllowedEmailDomains" `
    --value "<YOUR-ALLOWED-EMAIL-DOMAIN-LIST>" `
    --type SecureString `
    --profile <YOUR-PROFILE-NAME>
```

</details>

Example:

```bash
aws ssm put-parameter \
    --name "/LAIGO/AllowedEmailDomains" \
    --value "gmail.com,ubc.ca,student.ubc.ca,allard.ubc.ca" \
    --type SecureString \
    --profile <YOUR-PROFILE-NAME>
```

### Step 3: CDK Deployment

It's time to set up everything that goes on behind the scenes. For more detail on the backend architecture, see the [Architecture Deep Dive](architectureDeepDive.md), but backend knowledge is not required for deployment.

Open a terminal in the `cdk/` directory.

#### 3.1 Download requirements

Install requirements with npm:

```bash
npm install
```

#### 3.2 Initialize the CDK stack (only if needed)

Before running these commands for first deployment, make sure Docker Desktop is open and running in the background so CDK can bundle assets and layers properly.

Run this only if you have not deployed resources with CDK in this account/region before (or us-east-1).

Replace:

- `<YOUR-PROFILE-NAME>` with the AWS CLI profile used earlier.
- `<YOUR_AWS_ACCOUNT_ID>` with your AWS account ID.
- `<YOUR_PRIMARY_REGION>` with your primary deployment region.

```bash
npx cdk synth --profile <YOUR-PROFILE-NAME>
npx cdk bootstrap aws://<YOUR_AWS_ACCOUNT_ID>/<YOUR_PRIMARY_REGION> --profile <YOUR-PROFILE-NAME>
npx cdk bootstrap aws://<YOUR_AWS_ACCOUNT_ID>/us-east-1 --profile <YOUR-PROFILE-NAME>
```

#### 3.3 Deploy CDK stacks

Deploy all stacks at once. Replace:

- `<YOUR-PROFILE-NAME>` with the AWS CLI profile used earlier.
- `<YOUR-STACK-PREFIX>` with your stack prefix.

The stack prefix is added to physical resource names. `Environment` specifies the deployment environment (`dev`, `test`, `prod`), and `Version` specifies the application version.

```bash
npx cdk deploy --all \
    --parameters <YOUR-STACK-PREFIX>-Amplify:githubRepoName=Legal-Aid-Tool \
    --context StackPrefix=<YOUR-STACK-PREFIX> \
    --context Environment=dev \
    --context Version=1.2.0 \
    --context GithubRepo=Legal-Aid-Tool \
    --profile <YOUR-PROFILE-NAME>
```

If you have trouble running the command with `\`, remove the line breaks and run it as one line.

Example:

```bash
npx cdk deploy --all --parameters LegalAidTool-Amplify:githubRepoName=Legal-Aid-Tool --context StackPrefix=LegalAidTool --context Environment=dev --context Version=1.2.0 --context GithubRepo=Legal-Aid-Tool --profile <YOUR-PROFILE-NAME>
```

## Post-Deployment

### Step 1: Build AWS Amplify App

1. Log in to AWS console, and navigate to AWS Amplify. You can do so by typing Amplify in the search bar at the top.
2. From All apps, click `<stack-prefix>-Amplify-admin`.
3. Then click `main` under branches.
4. Click **Run job** and wait for the build to complete.
5. You now have access to the Amplify App ID and the public domain name to use the web app.

### Step 2: Visit Web App

You can now navigate to the web app URL to see your application in action.

## Cleanup

### Taking down the deployed stack

To take down the deployed stack for a fresh redeployment in the future, navigate to AWS CloudFormation on the AWS Console, click on the stack and hit Delete.

Please wait for the stacks in each step to be properly deleted before deleting the stack downstream.

Also make sure to delete secrets in Secrets Manager.

### Troubleshooting Stack Deletion

Sometimes stack deletion can fail. If you encounter issues while taking down your stacks:

1. **Aurora Database**: disable delete protection in Aurora for the database before attempting stack deletion, specifically when deleting the Database stack.
2. **ECR Repository**: ensure that nothing is present in ECR (Elastic Container Registry). Sometimes the stacks fail deletion due to remaining container images.
3. **Manual Cleanup**: if stacks continue to fail deletion, you may need to manually delete resources from ECR and other services before retrying the stack deletion.
