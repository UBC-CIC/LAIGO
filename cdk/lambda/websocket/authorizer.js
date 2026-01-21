const { CognitoJwtVerifier } = require("aws-jwt-verify");

let cognitoVerifier;

/**
 * Lambda Authorizer for WebSocket $connect route.
 * Validates Cognito JWT token and returns IAM Policy Document.
 */
exports.handler = async (event) => {
  const methodArn = event.methodArn;
  const timestamp = new Date().toISOString();

  try {
    const token = extractToken(event);

    if (!token) {
      console.warn("WebSocket authorizer: missing token", { timestamp });
      throw new Error("Unauthorized");
    }

    if (!cognitoVerifier) {
      cognitoVerifier = CognitoJwtVerifier.create({
        userPoolId: process.env.COGNITO_USER_POOL_ID,
        tokenUse: "id",
        clientId: process.env.COGNITO_CLIENT_ID,
      });
    }

    const decoded = await cognitoVerifier.verify(token);
    const cognitoId = decoded.sub;
    const email = decoded.email;
    const username = decoded["cognito:username"];

    console.log("WebSocket connection authorized", {
      timestamp,
      cognitoId,
      email,
      username,
    });

    // Return IAM Policy allowing the connection
    return generatePolicy(cognitoId, "Allow", methodArn, {
      email: email || "",
      username: username || "",
    });
  } catch (error) {
    console.error("WebSocket authorizer: token validation failed", {
      timestamp,
      reason: error?.message,
    });
    // Return explicit Deny policy
    return generatePolicy("unauthorized", "Deny", methodArn);
  }
};

function extractToken(event) {
  // Check Authorization header
  const headers = event.headers || {};
  const authHeader = headers.Authorization || headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }

  // Check query string parameter
  const queryParams = event.queryStringParameters || {};
  if (queryParams.token) {
    return queryParams.token;
  }

  return undefined;
}

/**
 * Generate IAM Policy Document for API Gateway WebSocket Authorizer
 */
function generatePolicy(principalId, effect, resource, context = {}) {
  const authResponse = {
    principalId: principalId,
  };

  if (effect && resource) {
    authResponse.policyDocument = {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: effect,
          Resource: resource,
        },
      ],
    };
  }

  // Add context to pass user info to downstream handlers
  if (Object.keys(context).length > 0) {
    authResponse.context = context;
  }

  return authResponse;
}
