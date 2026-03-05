const { CognitoJwtVerifier } = require("aws-jwt-verify");

let jwtVerifier;

/**
 * Lambda Authorizer for WebSocket $connect route.
 * Validates JWT token and returns IAM Policy Document.
 * 
 * Flow:
 * 1. Extracts JWT token from headers/query
 * 2. Verifies token signature and expiration
 * 3. Extracts "sub" claim as idpId
 * 4. Returns IAM policy with idpId in context (NO role/group validation)
 * 
 * Note: Authorization checks (role validation) are performed by WebSocket handlers
 * using database lookups, not JWT claims.
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

    // Initialize JWT verifier (IDP-agnostic)
    if (!jwtVerifier) {
      jwtVerifier = CognitoJwtVerifier.create({
        userPoolId: process.env.JWT_ISSUER_ID,
        tokenUse: "id",
        clientId: process.env.JWT_CLIENT_ID,
        // NO groups parameter - we don't validate groups in JWT
      });
    }

    // Validate JWT and extract sub claim
    const decoded = await jwtVerifier.verify(token);
    const idpId = decoded.sub;

    console.log("WebSocket connection authorized", {
      timestamp,
      idpId,
    });

    // Return IAM Policy allowing the connection
    // Pass only idpId to downstream handlers via context
    // Authorization checks (role validation) are performed by handlers using database lookups
    return generatePolicy(idpId, "Allow", methodArn, {
      idpId: idpId,
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

  // Check Sec-WebSocket-Protocol header
  const protocolHeader =
    headers["Sec-WebSocket-Protocol"] || headers["sec-websocket-protocol"];
  if (protocolHeader) {
    const protocols = protocolHeader.split(",").map((p) => p.trim());
    // Return the first protocol which we assume is the token
    if (protocols.length > 0) return protocols[0];
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
