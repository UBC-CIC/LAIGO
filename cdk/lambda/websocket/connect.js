const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const postgres = require("postgres");

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
    })
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

  console.log("WebSocket connection established:", {
    connectionId,
    idpId,
    timestamp: new Date().toISOString(),
  });

  // Store connection-to-user mapping in DynamoDB for notification targeting
  if (idpId) {
    try {
      // Query database to get userId from idpId
      const sql = await initializeDatabase();
      const user = await sql`
        SELECT user_id
        FROM users
        WHERE idp_id = ${idpId};
      `;

      if (user.length === 0) {
        console.error("User not found for idpId:", idpId);
        return { statusCode: 403, body: "User not found" };
      }

      const userId = user[0].user_id;

      const ttl = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 24 hours from now
      const connectedAt = new Date().toISOString();

      await dynamodb.send(
        new PutItemCommand({
          TableName: process.env.CONNECTION_TABLE_NAME,
          Item: {
            PK: { S: `CONNECTION#${connectionId}` },
            SK: { S: `USER#${userId}` },
            GSI1PK: { S: `USER#${userId}` },
            GSI1SK: { S: `CONNECTION#${connectionId}` },
            connectionId: { S: connectionId },
            userId: { S: userId },
            connectedAt: { S: connectedAt },
            lastActivity: { S: connectedAt },
            ttl: { N: ttl.toString() },
          },
        }),
      );

      console.log("Connection mapping stored successfully:", {
        connectionId,
        userId,
      });
    } catch (error) {
      console.error("Error storing connection mapping:", error);
      // Don't fail the connection for this error
    }
  }

  // Connection valid (authorized by Lambda Authorizer)
  const response = { statusCode: 200, body: "Connected" };

  // If the client sent a Sec-WebSocket-Protocol header (e.g. for auth), we must echo it back
  const headers = event.headers || {};
  const protocolHeader =
    headers["Sec-WebSocket-Protocol"] || headers["sec-websocket-protocol"];

  if (protocolHeader) {
    response.headers = {
      "Sec-WebSocket-Protocol": protocolHeader,
    };
  }

  return response;
};
