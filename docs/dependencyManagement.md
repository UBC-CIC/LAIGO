# Dependency Management Guide

## Overview

This document explains how dependencies are locked and managed across Lambda functions and Lambda layers in this project to ensure reproducible builds and security.

## Lambda Functions with Locked Dependencies

The following Lambda functions have their Python dependencies locked using `uv`:

| Lambda Function         | Location                            | Lock File          |
| ----------------------- | ----------------------------------- | ------------------ |
| `text_generation`       | `cdk/lambda/text_generation/`       | `requirements.txt` |
| `playground_generation` | `cdk/lambda/playground_generation/` | `requirements.txt` |

## Lambda Layers with Locked Dependencies

The following Lambda layers have locked dependencies:

| Layer Name        | Location                      | Language | Lock File           |
| ----------------- | ----------------------------- | -------- | ------------------- |
| `psycopg3`        | `cdk/layers/psycopg3/`        | Python   | `requirements.txt`  |
| `aws-jwt-verify`  | `cdk/layers/aws-jwt-verify/`  | Node.js  | `package-lock.json` |
| `postgres`        | `cdk/layers/postgres/`        | Node.js  | `package-lock.json` |
| `node-pg-migrate` | `cdk/layers/node-pg-migrate/` | Node.js  | `package-lock.json` |

## How Dependencies Were Locked

### 1. Requirements Structure

Python Lambda functions and Python layers use a two-file approach:

- `requirements.in` - Contains high-level dependencies (what we directly need)
- `requirements.txt` - Contains all dependencies with exact versions (generated from `requirements.in`)

Node.js layers use:

- `package.json` - Declares direct dependencies
- `package-lock.json` - Locks the full dependency tree with exact versions

### 2. Locking Process

Python dependencies are locked using `uv pip compile`.

Steps:

```bash
# From the repository root, compile a Lambda requirements lock file
uv pip compile cdk/lambda/text_generation/requirements.in \
  -o cdk/lambda/text_generation/requirements.txt

# Compile another Lambda requirements lock file
uv pip compile cdk/lambda/playground_generation/requirements.in \
  -o cdk/lambda/playground_generation/requirements.txt

# Compile the Python layer lock file (run inside the layer folder)
cd cdk/layers/psycopg3
uv pip compile requirements.in -o requirements.txt
```

For Node.js layers, lock files are generated/updated by npm:

```bash
# Example for a Node.js layer
cd cdk/layers/postgres
npm install
```

This updates `package-lock.json` to lock all transitive dependencies.

### 3. Key Locked Dependencies

**Python (LLM Lambda Functions):**

```
langchain==1.2.10
langchain-aws==1.3.0
langchain-community==0.4.1
langchain-core==1.2.16
langgraph==1.0.9
```

**Python (Database Connectivity):**

(`psycopg` and `psycopg-binary` are used in Lambda functions; `psycopg-pool` is locked in the `psycopg3` layer.)

```
psycopg==3.3.3
psycopg-binary==3.3.3
psycopg-pool==3.3.0
```

**Python (AWS Services):**

```
boto3==1.42.56 (text_generation)
boto3==1.42.57 (playground_generation)
botocore==1.42.56 (text_generation)
botocore==1.42.57 (playground_generation)
```

**Node.js Layers:**

```
aws-jwt-verify==4.0.1
postgres==3.4.7
node-pg-migrate==7.9.1
pg==8.13.3
```

## How to Modify Dependencies

### Adding New Dependencies

1. **Add to dependency source file:**

   - Python Lambda/Layer: add package to `requirements.in`
   - Node.js Layer: add package to `package.json` (or use `npm install <package>`)

2. **Regenerate lock file:**
   In the terminal run the following commands depending on target:

   ```bash
   # Python Lambda (example)
   uv pip compile cdk/lambda/text_generation/requirements.in \
     -o cdk/lambda/text_generation/requirements.txt

   # Python Layer (example)
   cd cdk/layers/psycopg3
   uv pip compile requirements.in -o requirements.txt

   # Node.js Layer (example)
   cd cdk/layers/node-pg-migrate
   npm install
   ```

3. **Commit and Push Changes:**
   After regenerating lock files, commit and push the updated files to trigger the deployment pipeline.

   - For Python Dockerized Lambda functions (for example `text_generation` and `playground_generation`), commit + push is sufficient. The CI/CD pipeline rebuilds and redeploys those functions.

   - For Lambda layers, after updating dependencies/lock files, keep Docker Desktop running and run:

     ```bash
     cd cdk
     npx cdk deploy --all \
       --context StackPrefix=<YOUR-STACK-PREFIX> \
       --context GithubRepo=<YOUR-GITHUB-REPO> \
       --profile <YOUR-PROFILE-NAME>
     ```

     This updates the layer assets in AWS.

   - **Option 1: Using Git in the Terminal**

     ```bash
     # Stage updated dependency files
     git add requirements.in requirements.txt package.json package-lock.json

     # Commit with a descriptive message
     git commit -m "Update Lambda/Lambda layer dependencies"

     # Push to your working branch (e.g., main or dev)
     git push origin <branch-name>
     ```

   - **Option 2: Using Git in Your IDE (e.g., VS Code)**

     1. Go to the Source Control tab.

     2. You’ll see updated dependency files under Changes.

     3. Write a commit message (e.g., “Update Lambda dependencies”).

     4. Click ✓ Commit.

     5. Click the … menu or right-click → Push to send your changes to the remote repository.

Once the push is complete, CodePipeline will automatically detect and redeploy affected Python Dockerized Lambda functions. Layer updates are applied when you run `cdk deploy`.

### Updating Existing Dependencies

1. **Use upgrade commands (recommended):**

   ```bash
   # Python: upgrade one package and regenerate lock file
   uv pip compile cdk/lambda/text_generation/requirements.in \
     -o cdk/lambda/text_generation/requirements.txt \
     --upgrade-package langchain

   # Python: upgrade all packages in a lock file
   uv pip compile cdk/lambda/playground_generation/requirements.in \
     -o cdk/lambda/playground_generation/requirements.txt \
     --upgrade

   # Node.js layer: upgrade according to package.json ranges
   cd cdk/layers/postgres
   npm update

   # Node.js layer: force latest major for a specific package
   npm install postgres@latest
   ```

2. **Manual pinning (optional):**

   If you need an exact version, update the source dependency file directly:

   - Python: pin in `requirements.in`, then run `uv pip compile ...`
   - Node.js: pin in `package.json` (or run `npm install <package>@<version>`)

3. **Commit and Push Changes:**

Once lock files (`requirements.txt` and/or `package-lock.json`) have been updated:

- Python Dockerized Lambda functions: commit and push to trigger CI/CD redeployment.
- Lambda layers: run `cdk deploy` (with Docker Desktop running) to publish updated layer assets:

  ```bash
  cd cdk
  npx cdk deploy --all \
    --context StackPrefix=<YOUR-STACK-PREFIX> \
    --context GithubRepo=<YOUR-GITHUB-REPO> \
    --profile <YOUR-PROFILE-NAME>
  ```
