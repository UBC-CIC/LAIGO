const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const { marshall } = require("@aws-sdk/util-dynamodb");
const { Logger } = require("@aws-lambda-powertools/logger");
const logger = new Logger({ serviceName: "WsConnect" });

const dynamodb = new DynamoDBClient({});

exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const userId = event.requestContext.authorizer?.userId;
  const userEmail = event.requestContext.authorizer?.email;

  logger.info("WebSocket connection established", {
    connectionId,
    userId,
    userEmail,
    timestamp: new Date().toISOString(),
  });

  // Store connection-to-user mapping in DynamoDB for notification targeting
  if (userId) {
    try {
      const ttl = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 24 hours from now
      const connectedAt = new Date().toISOString();

      const item = {
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
      };

      await dynamodb.send(new PutItemCommand(item));

      logger.info("WebSocket connection stored in DynamoDB", {
        connectionId,
        userId,
      });
    } catch (error) {
      logger.error("Failed to store connection in DynamoDB", error);
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
