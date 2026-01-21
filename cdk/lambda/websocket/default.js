const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");
const {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} = require("@aws-sdk/client-apigatewaymanagementapi");

const lambda = new LambdaClient({});

exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const domainName = event.requestContext.domainName;
  const stage = event.requestContext.stage;

  // Extract user identity from authorizer context
  const cognitoId = event.requestContext.authorizer?.principalId;
  const userEmail = event.requestContext.authorizer?.email;

  console.log("WebSocket message received:", {
    connectionId,
    routeKey: event.requestContext.routeKey,
    timestamp: new Date().toISOString(),
    cognitoId,
    userEmail,
  });

  try {
    const body = JSON.parse(event.body);
    const { action } = body;

    // Handle ping/pong for connection heartbeat
    if (action === "ping") {
      const apigw = new ApiGatewayManagementApiClient({
        endpoint: `https://${domainName}/${stage}`,
      });
      await apigw.send(
        new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: JSON.stringify({ type: "pong" }),
        })
      );
      return { statusCode: 200 };
    }

    // Handle text generation requests
    if (action === "generate_text") {
      const { case_id, sub_route, message_content } = body;

      // Log metadata only (scrub message_content to prevent PII leakage)
      console.log("Invoking text generation:", {
        case_id,
        sub_route,
        cognitoId,
        messageLength: message_content?.length || 0,
      });

      const textGenPayload = {
        isWebSocket: true,
        cognitoId: cognitoId, // Pass authenticated user ID
        queryStringParameters: {
          case_id: case_id,
          sub_route: sub_route,
        },
        body: JSON.stringify({
          message_content: message_content || "",
        }),
        requestContext: {
          connectionId: connectionId,
          domainName: domainName,
          stage: stage,
        },
      };

      await lambda.send(
        new InvokeCommand({
          FunctionName: process.env.TEXT_GEN_FUNCTION_NAME,
          InvocationType: "Event", // Asynchronous invocation
          Payload: JSON.stringify(textGenPayload),
        })
      );

      console.log("Text generation function invoked successfully");
      return { statusCode: 200 };
    }

    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Unknown action" }),
    };
  } catch (error) {
    console.error("Error processing WebSocket message:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
