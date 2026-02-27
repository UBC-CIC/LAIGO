// PostgreSQL client library
const postgres = require("postgres");
// AWS SDK imports for Secrets Manager
const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");

// Initialize Secrets Manager client for retrieving database credentials
const secretsManager = new SecretsManagerClient();

/**
 * Initialize PostgreSQL database connection using credentials from Secrets Manager
 * Creates a global connection object for reuse across Lambda invocations
 * @param {string} SM_DB_CREDENTIALS - Secrets Manager secret name containing DB credentials
 * @param {string} RDS_PROXY_ENDPOINT - RDS Proxy endpoint for database connection
 */
async function initializeConnection(SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT) {
  let credentials;
  try {
    // Retrieve database credentials from AWS Secrets Manager
    const getSecretValueCommand = new GetSecretValueCommand({
      SecretId: SM_DB_CREDENTIALS,
    });
    const secretResponse = await secretsManager.send(getSecretValueCommand);

    // Parse JSON credentials from secret
    credentials = JSON.parse(secretResponse.SecretString);

    console.log(`Connecting to database with user: ${credentials.username}`);

    // Configure PostgreSQL connection parameters with SSL/TLS enforcement
    const connectionConfig = {
      host: RDS_PROXY_ENDPOINT, // Use RDS Proxy for connection pooling
      port: credentials.port,
      username: credentials.username,
      password: credentials.password,
      database: credentials.dbname,
      ssl: { rejectUnauthorized: false }, // Allow self-signed certificates from RDS Proxy
    };

    // Create PostgreSQL connection and store globally for reuse
    global.sqlConnection = postgres(connectionConfig);

    // Test connection with simple query
    await global.sqlConnection`SELECT 1`;

    console.log("Database connection initialized and tested successfully");
  } catch (error) {
    console.error("Error initializing database connection:", error);
    console.error("Connection details:", {
      host: RDS_PROXY_ENDPOINT,
      username: credentials?.username,
      database: credentials?.dbname,
    });
    throw new Error(
      `Failed to initialize database connection: ${error.message}`
    );
  }
}

module.exports = { initializeConnection };
