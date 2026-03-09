const {
  DynamoDBClient,
  DeleteItemCommand,
} = require("@aws-sdk/client-dynamodb");
const { Logger } = require("@aws-lambda-powertools/logger");
const logger = new Logger({ serviceName: "WsDisconnect" });

const dynamodb = new DynamoDBClient({});
exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const userId = event.requestContext.authorizer?.userId;
  const timestamp = new Date().toISOString();

  logger.info("WebSocket connection closed", {
    connectionId,
    userId,
    timestamp,
  });

  // Clean up connection record from DynamoDB
  if (userId) {
    try {
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
    } catch (error) {
      logger.error("Error cleaning up connection mapping", error);
      // Don't fail the disconnect for this error
    }
  } else {
    logger.warn("No userId found in authorizer context for disconnect", {
      connectionId,
    });
  }

  return { statusCode: 200 };
};
