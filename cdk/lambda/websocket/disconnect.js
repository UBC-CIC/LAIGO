const { DynamoDBClient, DeleteItemCommand } = require("@aws-sdk/client-dynamodb");
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

  console.log("WebSocket connection closed:", {
    connectionId: event.requestContext.connectionId,
    domainName: event.requestContext.domainName,
    stage: event.requestContext.stage,
    idpId,
    timestamp: new Date().toISOString(),
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

        await dynamodb.send(new DeleteItemCommand({
          TableName: process.env.CONNECTION_TABLE_NAME,
          Key: {
            PK: { S: `CONNECTION#${connectionId}` },
            SK: { S: `USER#${userId}` }
          }
        }));

        console.log("Connection mapping cleaned up successfully:", {
          connectionId,
          userId
        });
      }
    } catch (error) {
      console.error("Error cleaning up connection mapping:", error);
      // Don't fail the disconnect for this error
    }
  }

  return { statusCode: 200 };
};
