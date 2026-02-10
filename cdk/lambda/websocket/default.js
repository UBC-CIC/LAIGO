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
    const { action, requestId } = body;

    // Handle ping/pong for connection heartbeat
    if (action === "ping") {
      const apigw = new ApiGatewayManagementApiClient({
        endpoint: `https://${domainName}/${stage}`,
      });
      await apigw.send(
        new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: JSON.stringify({ type: "pong" }),
        }),
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
        requestId,
        messageLength: message_content?.length || 0,
      });

      const textGenPayload = {
        isWebSocket: true,
        cognitoId: cognitoId,
        requestId: requestId, // Pass request ID for response correlation
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
          InvocationType: "Event",
          Payload: JSON.stringify(textGenPayload),
        }),
      );

      console.log("Text generation function invoked successfully");
      return { statusCode: 200 };
    }

    // Handle playground test requests
    if (action === "playground_test") {
      const {
        message_content,
        block_type,
        test_id,
        custom_prompt,
        model_id,
        temperature,
        top_p,
        max_tokens,
        case_context,
      } = body;

      console.log("Invoking playground test:", {
        block_type,
        test_id,
        cognitoId,
        requestId,
        model_id,
      });

      const playgroundPayload = {
        isWebSocket: true,
        cognitoId: cognitoId,
        requestId: requestId,
        queryStringParameters: {
          playground_mode: "true",
          sub_route: block_type, // Map block_type to sub_route logic if needed, or handle directly
        },
        body: JSON.stringify({
          message_content: message_content || "",
          block_type: block_type,
          test_id: test_id,
          custom_prompt: custom_prompt,
          model_id: model_id,
          temperature: temperature,
          top_p: top_p,
          max_tokens: max_tokens,
          case_context: case_context,
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
          InvocationType: "Event",
          Payload: JSON.stringify(playgroundPayload),
        }),
      );

      console.log("Playground test invoked successfully");
      return { statusCode: 200 };
    }

    // Handle assess progress requests
    if (action === "assess_progress") {
      const { case_id, block_type } = body;

      console.log("Invoking assess_progress:", {
        case_id,
        block_type,
        cognitoId,
        requestId,
      });

      const assessPayload = {
        isWebSocket: true,
        cognitoId: cognitoId,
        requestId: requestId,
        body: JSON.stringify({ case_id, block_type }),
        requestContext: {
          connectionId: connectionId,
          domainName: domainName,
          stage: stage,
        },
      };

      await lambda.send(
        new InvokeCommand({
          FunctionName: process.env.ASSESS_PROGRESS_FUNCTION_NAME,
          InvocationType: "Event",
          Payload: JSON.stringify(assessPayload),
        }),
      );

      console.log("Assess progress function invoked successfully");
      return { statusCode: 200 };
    }

    // Handle summary generation requests
    if (action === "generate_summary") {
      const { case_id, sub_route } = body;

      console.log("Invoking generate_summary:", {
        case_id,
        sub_route,
        cognitoId,
        requestId,
      });

      const summaryPayload = {
        isWebSocket: true,
        cognitoId: cognitoId,
        requestId: requestId,
        queryStringParameters: {
          case_id: case_id,
          sub_route: sub_route,
        },
        requestContext: {
          connectionId: connectionId,
          domainName: domainName,
          stage: stage,
        },
      };

      await lambda.send(
        new InvokeCommand({
          FunctionName: process.env.SUMMARY_GEN_FUNCTION_NAME,
          InvocationType: "Event",
          Payload: JSON.stringify(summaryPayload),
        }),
      );

      console.log("Summary generation function invoked successfully");
      return { statusCode: 200 };
    }

    // Handle audio transcription requests
    if (action === "audio_to_text") {
      const { audio_file_id, file_name, file_type, case_title, case_id } = body;

      console.log("Invoking audio_to_text:", {
        audio_file_id,
        file_name,
        file_type,
        case_id,
        cognitoId,
        requestId,
      });

      const audioPayload = {
        isWebSocket: true,
        cognitoId: cognitoId,
        requestId: requestId,
        body: JSON.stringify({
          audio_file_id,
          file_name,
          file_type,
          case_title,
          case_id,
        }),
        requestContext: {
          connectionId: connectionId,
          domainName: domainName,
          stage: stage,
        },
      };

      await lambda.send(
        new InvokeCommand({
          FunctionName: process.env.AUDIO_TO_TEXT_FUNCTION_NAME,
          InvocationType: "Event",
          Payload: JSON.stringify(audioPayload),
        }),
      );

      console.log("Audio to text function invoked successfully");
      return { statusCode: 200 };
    }

    // Handle notification delivery (from notification service)
    if (action === "notification_delivery") {
      const { type, notification } = body;

      console.log("Delivering notification via WebSocket:", {
        connectionId,
        type,
        notificationId: notification?.notificationId,
        cognitoId,
      });

      const apigw = new ApiGatewayManagementApiClient({
        endpoint: `https://${domainName}/${stage}`,
      });

      try {
        await apigw.send(
          new PostToConnectionCommand({
            ConnectionId: connectionId,
            Data: JSON.stringify({
              action: "notification_delivery",
              type: type,
              notification: notification,
              timestamp: new Date().toISOString(),
            }),
          }),
        );

        console.log("Notification delivered successfully via WebSocket");
        return { statusCode: 200 };
      } catch (error) {
        console.error("Error delivering notification via WebSocket:", error);
        // If connection is stale, the notification service will handle retry
        return { statusCode: 410 }; // Gone - connection no longer exists
      }
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
