/**
 * Instructor Authorizer Lambda Function
 * 
 * This Lambda authorizer validates JWT tokens from Cognito and ensures the user
 * belongs to either the 'instructor' or 'admin' group before allowing access to
 * instructor endpoints. Admins have elevated access to instructor resources.
 * 
 * Flow:
 * 1. API Gateway receives request with Authorization header
 * 2. Invokes this Lambda with the token
 * 3. Lambda verifies token and checks instructor/admin group membership
 * 4. Returns IAM policy allowing/denying access
 */

const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");
const { CognitoJwtVerifier } = require("aws-jwt-verify");

// Create a Secrets Manager client
const secretsManager = new SecretsManagerClient();

// Environment variable containing the secret name for Cognito credentials
let { SM_COGNITO_CREDENTIALS } = process.env;

// IAM policy response structure returned to API Gateway
const responseStruct = {
  principalId: "yyyyyyyy", // User identifier from JWT token (replaced with actual sub)
  policyDocument: {
    Version: "2012-10-17",
    Statement: [], // IAM policy statements (Allow/Deny)
  },
  context: {}, // Additional context passed to backend Lambda functions
};

// JWT verifier instance (initialized once during cold start for performance)
// Caches JWKS (JSON Web Key Set) to avoid fetching on every invocation
let jwtVerifier;

/**
 * Initialize JWT verifier with Cognito configuration from Secrets Manager
 * Called once during Lambda cold start to set up the verifier
 */
async function initializeConnection() {
  try {
    // Retrieve Cognito configuration from Secrets Manager
    const getSecretValueCommand = new GetSecretValueCommand({
      SecretId: SM_COGNITO_CREDENTIALS,
    });
    const secretResponse = await secretsManager.send(getSecretValueCommand);

    const credentials = JSON.parse(secretResponse.SecretString);

    // Create JWT verifier configured to validate instructor or admin group membership
    jwtVerifier = CognitoJwtVerifier.create({
      userPoolId: credentials.VITE_COGNITO_USER_POOL_ID,
      tokenUse: "id", // Validate ID tokens (not access tokens)
      groups: ["instructor", "admin"], // Allow users in 'instructor' or 'admin' groups
      clientId: credentials.VITE_COGNITO_USER_POOL_CLIENT_ID,
    });
  } catch (error) {
    console.error("Error initializing JWT verifier:", error);
    throw new Error("Failed to initialize JWT verifier");
  }
}

/**
 * Lambda handler function invoked by API Gateway for authorization
 */
exports.handler = async (event) => {
  // Initialize verifier on first invocation (cold start)
  if (!jwtVerifier) {
    await initializeConnection();
  }

  // Extract JWT token from Authorization header
  const accessToken = event.authorizationToken.toString();
  let payload;

  try {
    // Verify token signature, expiration, and instructor/admin group membership
    payload = await jwtVerifier.verify(accessToken);

    // Extract API Gateway resource ARN and create wildcard policy
    // Example: arn:aws:execute-api:region:account:api-id/stage/method/resource
    const parts = event.methodArn.split("/");
    const resource = parts.slice(0, 2).join("/") + "*"; // Allow all resources under this stage
    
    // Build IAM policy allowing access
    responseStruct["principalId"] = payload.sub; // Cognito user ID
    responseStruct["policyDocument"]["Statement"].push({
      Action: "execute-api:Invoke",
      Effect: "Allow",
      Resource: resource,
    });
    // Pass user ID to backend Lambda functions via context
    responseStruct["context"] = {
      userId: payload.sub,
    };

    return responseStruct;
  } catch (error) {
    console.error("Authorization error:", error);
    // API Gateway requires exact "Unauthorized" message for 401 response
    throw new Error("Unauthorized");
  }
};
