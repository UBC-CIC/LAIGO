const { DynamoDBClient, DeleteItemCommand } = require("@aws-sdk/client-dynamodb");

const dynamodb = new DynamoDBClient({});

exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const userId = event.requestContext.authorizer?.userId;

  console.log("WebSocket connection closed:", {
    connectionId: event.requestContext.connectionId,
    domainName: event.requestContext.domainName,
    stage: event.requestContext.stage,
    userId,
    timestamp: new Date().toISOString(),
  });

  // Clean up connection record from DynamoDB
  if (userId) {
    try {
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
    } catch (error) {
      console.error("Error cleaning up connection mapping:", error);
      // Don't fail the disconnect for this error
    }
  }

  return { statusCode: 200 };
};
