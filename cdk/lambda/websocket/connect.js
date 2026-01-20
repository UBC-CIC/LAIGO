const { CognitoJwtVerifier } = require("aws-jwt-verify");

let cognitoVerifier;

exports.handler = async (event) => {
  const connectionId = event.requestContext?.connectionId;
  const domainName = event.requestContext?.domainName;
  const stage = event.requestContext?.stage;
  const timestamp = new Date().toISOString();

  try {
    const token = extractToken(event);

    if (!token) {
      console.warn("WebSocket connect rejected: missing token", {
        connectionId,
        domainName,
        stage,
        timestamp,
      });
      return { statusCode: 401, body: "Unauthorized" };
    }

    if (!cognitoVerifier) {
      cognitoVerifier = CognitoJwtVerifier.create({
        userPoolId: process.env.COGNITO_USER_POOL_ID,
        tokenUse: "id",
        clientId: process.env.COGNITO_CLIENT_ID,
      });
    }

    const decoded = await cognitoVerifier.verify(token);

    console.log("WebSocket connection authorized", {
      connectionId,
      domainName,
      stage,
      timestamp,
      claims: {
        sub: decoded?.sub,
        email: decoded?.email,
        "cognito:username": decoded?.["cognito:username"],
      },
    });

    return { statusCode: 200 };
  } catch (error) {
    console.error("WebSocket connect rejected: invalid token", {
      connectionId,
      domainName,
      stage,
      timestamp,
      reason: error?.message,
    });
    return { statusCode: 401, body: "Unauthorized" };
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
