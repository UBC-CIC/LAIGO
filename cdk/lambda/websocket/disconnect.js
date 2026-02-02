const { DynamoDBClient, DeleteItemCommand } = require("@aws-sdk/client-dynamodb");

const dynamodb = new DynamoDBClient({});

exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const cognitoId = event.requestContext.authorizer?.principalId;

  console.log("WebSocket connection closed:", {
    connectionId: event.requestContext.connectionId,
    domainName: event.requestContext.domainName,
    stage: event.requestContext.stage,
    cognitoId,
    timestamp: new Date().toISOString(),
  });

  // Clean up connection record from DynamoDB
  if (cognitoId) {
    try {
      await dynamodb.send(new DeleteItemCommand({
        TableName: process.env.CONNECTION_TABLE_NAME,
        Key: {
          PK: { S: `CONNECTION#${connectionId}` },
          SK: { S: `USER#${cognitoId}` }
        }
      }));

      console.log("Connection mapping cleaned up successfully:", {
        connectionId,
        cognitoId
      });
    } catch (error) {
      console.error("Error cleaning up connection mapping:", error);
      // Don't fail the disconnect for this error
    }
  }

  return { statusCode: 200 };
};
