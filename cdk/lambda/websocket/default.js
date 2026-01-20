const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");
const lambda = new LambdaClient({});
exports.handler = async (event) => {
  console.log("WebSocket message received:", {
    connectionId: event.requestContext.connectionId,
    routeKey: event.requestContext.routeKey,
    body: event.body,
    timestamp: new Date().toISOString(),
  });
  try {
    const body = JSON.parse(event.body);
    const { action, textbook_id, query, chat_session_id } = body;
    if (action === "generate_text") {
      // Invoke the text generation Lambda function
      const textGenPayload = {
        pathParameters: {
          id: chat_session_id,
        },
        body: JSON.stringify({
          textbook_id: textbook_id,
          query: query,
        }),
        requestContext: {
          connectionId: event.requestContext.connectionId,
          domainName: event.requestContext.domainName,
          stage: event.requestContext.stage,
        },
      };
      console.log(
        "Invoking text generation function with payload:",
        textGenPayload
      );
      const result = await lambda.send(
        new InvokeCommand({
          FunctionName: process.env.TEXT_GEN_FUNCTION_NAME,
          InvocationType: "Event", // Asynchronous invocation
          Payload: JSON.stringify(textGenPayload),
        })
      );
      console.log("Text generation function invoked successfully:", result);
      return { statusCode: 200 };
    }

    // Handle warmup requests - invoke practice material Lambda to pre-warm it
    if (action === "warmup") {
      console.log("Warmup request received");
      const warmupPayload = {
        warmup: true, // Flag to trigger early return in Lambda
      };
      try {
        await lambda.send(
          new InvokeCommand({
            FunctionName: process.env.PRACTICE_MATERIAL_FUNCTION_NAME,
            InvocationType: "Event", // Fire-and-forget
            Payload: JSON.stringify(warmupPayload),
          })
        );
        console.log("Warmup invocation sent successfully");
      } catch (warmupError) {
        console.warn("Warmup invocation failed:", warmupError);
        // Don't fail the request - warmup is best-effort
      }
      return { statusCode: 200, body: JSON.stringify({ status: "warming" }) };
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
