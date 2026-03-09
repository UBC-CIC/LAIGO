const {
  DynamoDBClient,
  DeleteItemCommand,
} = require("@aws-sdk/client-dynamodb");
const { marshall } = require("@aws-sdk/util-dynamodb");
const { Logger } = require("@aws-lambda-powertools/logger");
const postgres = require("postgres");
const logger = new Logger({ serviceName: "WsDisconnect" });

const dynamodb = new DynamoDBClient({});
let sqlConnection;

/**
 * Initialize database connection using RDS Proxy
 */
async function initializeDatabase() {
  if (sqlConnection) return sqlConnection;

  const secretsManager = require("@aws-sdk/client-secrets-manager");
  const client = new secretsManager.SecretsManagerClient();

  const response = await client.send(
    new secretsManager.GetSecretValueCommand({
      SecretId: process.env.SM_DB_CREDENTIALS,
    }),
  );

  const secret = JSON.parse(response.SecretString);

  sqlConnection = postgres({
    host: process.env.RDS_PROXY_ENDPOINT,
    port: 5432,
    database: secret.dbname,
    username: secret.username,
    password: secret.password,
    ssl: "require",
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return sqlConnection;
}

exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const idpId = event.requestContext.authorizer?.idpId;
  const timestamp = new Date().toISOString();

  logger.info("WebSocket connection closed", {
    connectionId: event.requestContext.connectionId,
    domainName: event.requestContext.domainName,
    stage: event.requestContext.stage,
    idpId,
    timestamp,
  });

  // Clean up connection record from DynamoDB
  if (idpId) {
    try {
      // Query database to get userId from idpId
      const sql = await initializeDatabase();
      const user = await sql`
        SELECT user_id
        FROM users
        WHERE idp_id = ${idpId};
      `;

      if (user.length > 0) {
        const userId = user[0].user_id;

        await dynamodb.send(
          new DeleteItemCommand({
            TableName: process.env.CONNECTION_TABLE_NAME,
            Key: {
              PK: { S: `CONNECTION#${connectionId}` },
              SK: { S: `USER#${userId}` },
            },
          }),
        );

        logger.info("Connection mapping cleaned up successfully", {
          connectionId,
          userId,
        });
      } else {
        logger.info("No user found for idpId, skipping DynamoDB cleanup", {
          idpId,
        });
      }
    } catch (error) {
      logger.error("Error cleaning up connection mapping", error);
      // Don't fail the disconnect for this error
    }
  }

  return { statusCode: 200 };
};
