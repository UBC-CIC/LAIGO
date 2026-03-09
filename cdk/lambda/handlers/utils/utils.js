const { initializeConnection } = require("../initializeConnection");
const { Logger } = require("@aws-lambda-powertools/logger");
const logger = new Logger({ serviceName: "HandlerUtils" });

let { SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT } = process.env;
let sqlConnection;

const initConnection = async () => {
  if (!global.sqlConnection) {
    await initializeConnection(SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT);
  }
};

const createResponse = () => ({
  statusCode: 200,
  headers: {
    "Access-Control-Allow-Headers":
      "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "*",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none';",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  },
  body: "",
});

const parseBody = (body) => {
  try {
    return JSON.parse(body || "{}");
  } catch {
    throw new Error("Invalid JSON body");
  }
};

const handleError = (error, response) => {
  response.statusCode = 500;
  logger.error("Request failed", error);
  response.body = JSON.stringify({
    error: error.message || "Internal server error",
  });
};

// Lambda execution context cache for user metadata
let userMetadataCache = {};

/**
 * Retrieves user metadata from the database by IDP ID with Lambda execution context caching.
 *
 * @param {string} idpId - The IDP user identifier (e.g., Cognito sub claim)
 * @returns {Promise<Object>} User object with user_id, email, first_name, last_name, roles
 * @throws {Error} Throws "User not found" if user doesn't exist in database
 */
const getUserMetadata = async (idpId) => {
  // Check cache first
  if (userMetadataCache[idpId]) {
    return userMetadataCache[idpId];
  }

  // Ensure database connection is initialized
  if (!global.sqlConnection) {
    await initConnection();
  }

  const sqlConnection = global.sqlConnection;

  // Query database by idp_id column
  const result = await sqlConnection`
    SELECT user_id, user_email, first_name, last_name, roles
    FROM users
    WHERE idp_id = ${idpId};
  `;

  if (result.length === 0) {
    throw new Error("User not found");
  }

  const user = {
    user_id: result[0].user_id,
    email: result[0].user_email,
    first_name: result[0].first_name,
    last_name: result[0].last_name,
    roles: result[0].roles,
  };

  // Cache for this execution context
  userMetadataCache[idpId] = user;

  return user;
};

module.exports = {
  initConnection,
  createResponse,
  parseBody,
  handleError,
  getSqlConnection: () => global.sqlConnection,
  getUserMetadata,
};
