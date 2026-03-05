/**
 * Instructor Authorizer Lambda Function
 *
 * This Lambda authorizer validates JWT tokens from an IDP (Identity Provider)
 * and extracts the user identifier for downstream authorization checks.
 *
 * Flow:
 * 1. API Gateway receives request with Authorization header
 * 2. Invokes this Lambda with the token
 * 3. Lambda verifies token signature and expiration
 * 4. Extracts "sub" claim as idpId
 * 5. Returns IAM policy with idpId in context (NO role/group validation)
 *
 * Note: Authorization checks (role validation) are performed by API handlers
 * using database lookups, not by this authorizer.
 */

const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");
const { CognitoJwtVerifier } = require("aws-jwt-verify");

// Create a Secrets Manager client
const secretsManager = new SecretsManagerClient();

// Environment variables for IDP configuration
let { SM_IDP_CREDENTIALS } = process.env;

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
 * Initialize JWT verifier with IDP configuration from Secrets Manager
 * Called once during Lambda cold start to set up the verifier
 */
async function initializeConnection() {
  try {
    // Retrieve IDP configuration from Secrets Manager
    const getSecretValueCommand = new GetSecretValueCommand({
      SecretId: SM_IDP_CREDENTIALS,
    });
    const secretResponse = await secretsManager.send(getSecretValueCommand);

    const credentials = JSON.parse(secretResponse.SecretString);

    // Create JWT verifier configured to validate tokens from the IDP
    // Note: NO group validation - authorization is handled by API handlers
    jwtVerifier = CognitoJwtVerifier.create({
      userPoolId: credentials.JWT_ISSUER_ID,
      tokenUse: "id", // Validate ID tokens (not access tokens)
      clientId: credentials.JWT_CLIENT_ID,
      // NO groups parameter - we don't validate groups in JWT
    });

    // Log verifier initialization (no secrets)
    console.log("Instructor JWT verifier initialized", {
      issuerId: credentials.JWT_ISSUER_ID,
    });
  } catch (error) {
    console.error("Error initializing JWT verifier:", {
      name: error?.name,
      message: error?.message,
    });
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
  console.log("Instructor authorizer invoked", { methodArn: event.methodArn });
  let payload;

  try {
    // Verify token signature and expiration (NO group validation)
    payload = await jwtVerifier.verify(accessToken);

    // Extract idpId from "sub" claim
    const idpId = payload.sub;

    // Use a scoped wildcard to allow caching across all endpoints within this role's scope
    // This allows the authorizer to be cached while ensuring the policy doesn't leak access to other roles.
    const parts = event.methodArn.split("/");
    const resource = parts.slice(0, 2).join("/") + "/*/instructor/*";

    // Build IAM policy allowing access
    responseStruct["principalId"] = idpId; // IDP user identifier
    responseStruct["policyDocument"]["Statement"].push({
      Action: "execute-api:Invoke",
      Effect: "Allow",
      Resource: resource,
    });
    // Pass only idpId to backend Lambda functions via context
    // Authorization checks (role validation) are performed by handlers using database lookups
    responseStruct["context"] = {
      idpId: idpId,
    };

    return responseStruct;
  } catch (error) {
    console.error("Authorization error:", {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
    });
    // API Gateway requires exact "Unauthorized" message for 401 response
    throw new Error("Unauthorized");
  }
};
