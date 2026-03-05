const {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand,
  DeleteItemCommand,
} = require("@aws-sdk/client-dynamodb");
const {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} = require("@aws-sdk/client-apigatewaymanagementapi");
const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
const postgres = require("postgres");

const dynamodb = new DynamoDBClient({});
const secretsManager = new SecretsManagerClient({});

// Database connection (initialized on first use)
let sqlConnection;

/**
 * Notification Service Lambda
 * Handles notification creation, storage, and real-time delivery via WebSocket
 *
 * Supports two invocation modes:
 * 1. EventBridge events for notification creation and delivery
 * 2. REST API requests for notification queries and updates
 */
exports.handler = async (event, context) => {
  console.log("Notification Service invoked:", {
    source: event.source || "API",
    eventType: event["detail-type"] || event.httpMethod,
    timestamp: new Date().toISOString(),
  });

  try {
    // Handle EventBridge events
    if (event.source === "notification.system") {
      return await handleEventBridgeEvent(event);
    }

    // Handle REST API requests
    if (event.httpMethod) {
      return await handleRestApiRequest(event);
    }

    throw new Error("Unknown invocation type");
  } catch (error) {
    console.error("Error in notification service:", error);
    return {
      statusCode: 500,
      headers: getCorsHeaders(),
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};

/**
 * Initialize database connection using RDS Proxy
 */
async function initializeDatabase() {
  if (sqlConnection) return sqlConnection;

  const response = await secretsManager.send(
    new GetSecretValueCommand({
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
    max: 2, // Notification service may need a few connections
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return sqlConnection;
}

/**
 * Get database user_id from IDP identifier
 * @param {string} idpId - IDP user identifier (JWT sub claim)
 * @returns {Promise<string>} Database user_id
 * @throws {Error} If user not found
 */
async function getUserIdFromIdpId(idpId) {
  const sql = await initializeDatabase();

  const user = await sql`
    SELECT user_id
    FROM users
    WHERE idp_id = ${idpId};
  `;

  if (user.length === 0) {
    throw new Error("User not found");
  }

  return user[0].user_id;
}

/**
 * Handle EventBridge notification events
 */
async function handleEventBridgeEvent(event) {
  const { detail } = event;
  const eventType = event["detail-type"];

  console.log("Processing EventBridge event:", {
    eventType,
    recipientId: detail.recipientId, // Database user_id
    notificationType: detail.type,
  });

  // Create notification record
  const notification = await createNotification(detail);

  // Attempt real-time delivery via WebSocket
  await deliverNotificationViaWebSocket(notification);

  return { statusCode: 200 };
}

/**
 * Handle REST API requests for notification management
 */
async function handleRestApiRequest(event) {
  const { httpMethod, resource, pathParameters, queryStringParameters } = event;
  const idpId = event.requestContext?.authorizer?.idpId;

  if (!idpId) {
    return {
      statusCode: 401,
      headers: getCorsHeaders(),
      body: JSON.stringify({ error: "Unauthorized" }),
    };
  }

  // Query database to get user_id from idp_id
  let userId;
  try {
    userId = await getUserIdFromIdpId(idpId);
  } catch (error) {
    console.error("Error getting user_id from idp_id:", error);
    return {
      statusCode: 403,
      headers: getCorsHeaders(),
      body: JSON.stringify({ error: "User not found" }),
    };
  }

  const pathData = `${httpMethod} ${resource}`;

  switch (pathData) {
    case "GET /student/notifications":
      return await getNotifications(userId, queryStringParameters);

    case "PUT /student/notifications/{notificationId}/read":
      return await markNotificationAsRead(
        userId,
        pathParameters.notificationId,
      );

    case "PUT /student/notifications/read-all":
      return await markAllNotificationsAsRead(userId);

    case "PUT /student/notifications/{notificationId}/unread":
      return await markNotificationAsUnread(
        userId,
        pathParameters.notificationId,
      );

    case "DELETE /student/notifications/{notificationId}":
      return await deleteNotification(userId, pathParameters.notificationId);

    case "GET /student/notifications/unread-count":
      return await getUnreadCount(userId);

    default:
      return {
        statusCode: 404,
        headers: getCorsHeaders(),
        body: JSON.stringify({ error: "Route not found" }),
      };
  }
}

/**
 * Create a new notification record in DynamoDB
 * @param {Object} eventDetail - Event detail from EventBridge
 * @param {string} eventDetail.recipientId - Database user_id (not idp_id or cognito_id)
 * @param {string} eventDetail.type - Notification type
 * @param {string} eventDetail.title - Notification title
 * @param {string} eventDetail.message - Notification message
 * @param {Object} eventDetail.metadata - Additional metadata
 * @param {string} eventDetail.createdBy - User ID of creator (optional)
 */
async function createNotification(eventDetail) {
  const {
    type,
    recipientId, // Database user_id
    title,
    message,
    metadata = {},
    createdBy,
  } = eventDetail;

  const notificationId = generateNotificationId();
  const timestamp = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days

  const notification = {
    PK: `USER#${recipientId}`, // Database user_id
    SK: `NOTIFICATION#${timestamp}#${notificationId}`,
    GSI1PK: `NOTIFICATION#${notificationId}`,
    GSI1SK: `USER#${recipientId}`, // Database user_id
    notificationId,
    userId: recipientId, // Database user_id
    type,
    title,
    message,
    metadata,
    isRead: false,
    readStatus: "UNREAD",
    createdAt: timestamp,
    ttl,
    ...(createdBy && { createdBy }),
  };

  await dynamodb.send(
    new PutItemCommand({
      TableName: process.env.NOTIFICATION_TABLE_NAME,
      Item: marshall(notification),
    }),
  );

  console.log("Notification created:", {
    notificationId,
    userId: recipientId, // Database user_id
    type,
  });

  return notification;
}

/**
 * Deliver notification to user via WebSocket if they're online
 * @param {Object} notification - Notification object
 * @param {string} notification.userId - Database user_id (not idp_id or cognito_id)
 */
async function deliverNotificationViaWebSocket(notification) {
  const userId = notification.userId; // Database user_id

  try {
    // Get active connections for the user
    const connections = await getUserConnections(userId);

    if (connections.length === 0) {
      console.log("No active connections for user:", userId);
      return;
    }

    const wsEndpoint = process.env.WEBSOCKET_API_ENDPOINT;
    const apigw = new ApiGatewayManagementApiClient({
      endpoint: wsEndpoint,
    });

    // Deliver to all active connections
    const deliveryPromises = connections.map(async (connection) => {
      try {
        await apigw.send(
          new PostToConnectionCommand({
            ConnectionId: connection.connectionId,
            Data: JSON.stringify({
              action: "notification_delivery",
              type: notification.type,
              notification: {
                notificationId: notification.notificationId,
                type: notification.type,
                title: notification.title,
                message: notification.message,
                metadata: notification.metadata,
                createdAt: notification.createdAt,
                isRead: notification.isRead,
              },
              timestamp: new Date().toISOString(),
            }),
          }),
        );

        console.log("Notification delivered via WebSocket:", {
          connectionId: connection.connectionId,
          notificationId: notification.notificationId,
        });
      } catch (error) {
        console.error("Failed to deliver to connection:", {
          connectionId: connection.connectionId,
          error: error.message,
        });

        // If connection is stale (410 Gone), clean it up
        if (error.statusCode === 410) {
          await cleanupStaleConnection(connection.connectionId, userId);
        }
      }
    });

    await Promise.allSettled(deliveryPromises);
  } catch (error) {
    console.error("Error delivering notification via WebSocket:", error);
    // Don't throw - notification is still stored even if delivery fails
  }
}

/**
 * Get active WebSocket connections for a user
 * @param {string} userId - Database user_id (not idp_id or cognito_id)
 * @returns {Promise<Array>} Array of connection objects
 */
async function getUserConnections(userId) {
  try {
    const result = await dynamodb.send(
      new QueryCommand({
        TableName: process.env.CONNECTION_TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk",
        ExpressionAttributeValues: {
          ":pk": { S: `USER#${userId}` }, // Database user_id
        },
      }),
    );

    return result.Items?.map((item) => unmarshall(item)) || [];
  } catch (error) {
    console.error("Error getting user connections:", error);
    return [];
  }
}

/**
 * Clean up stale WebSocket connection
 * @param {string} connectionId - WebSocket connection ID
 * @param {string} userId - Database user_id (not idp_id or cognito_id)
 */
async function cleanupStaleConnection(connectionId, userId) {
  try {
    await dynamodb.send(
      new DeleteItemCommand({
        TableName: process.env.CONNECTION_TABLE_NAME,
        Key: marshall({
          PK: `CONNECTION#${connectionId}`,
          SK: `USER#${userId}`, // Database user_id
        }),
      }),
    );

    console.log("Cleaned up stale connection:", connectionId);
  } catch (error) {
    console.error("Error cleaning up stale connection:", error);
  }
}

/**
 * Get notifications for a user with pagination
 */
async function getNotifications(userId, queryParams = {}) {
  const limit = parseInt(queryParams.limit) || 20;
  const lastKey = queryParams.lastKey;

  try {
    const params = {
      TableName: process.env.NOTIFICATION_TABLE_NAME,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: {
        ":pk": { S: `USER#${userId}` },
      },
      ScanIndexForward: false, // Reverse chronological order
      Limit: limit,
    };

    if (lastKey) {
      params.ExclusiveStartKey = JSON.parse(
        Buffer.from(lastKey, "base64").toString(),
      );
    }

    const result = await dynamodb.send(new QueryCommand(params));

    const notifications =
      result.Items?.map((item) => {
        const notification = unmarshall(item);
        // Remove DynamoDB keys from response
        delete notification.PK;
        delete notification.SK;
        delete notification.GSI1PK;
        delete notification.GSI1SK;
        delete notification.ttl;
        return notification;
      }) || [];

    const response = {
      notifications,
      hasMore: !!result.LastEvaluatedKey,
    };

    if (result.LastEvaluatedKey) {
      response.nextKey = Buffer.from(
        JSON.stringify(result.LastEvaluatedKey),
      ).toString("base64");
    }

    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error("Error getting notifications:", error);
    return {
      statusCode: 500,
      headers: getCorsHeaders(),
      body: JSON.stringify({ error: "Failed to get notifications" }),
    };
  }
}

/**
 * Mark a specific notification as read
 */
async function markNotificationAsRead(userId, notificationId) {
  try {
    // First, get the notification to verify ownership and get the sort key
    const getResult = await dynamodb.send(
      new QueryCommand({
        TableName: process.env.NOTIFICATION_TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk AND GSI1SK = :sk",
        ExpressionAttributeValues: {
          ":pk": { S: `NOTIFICATION#${notificationId}` },
          ":sk": { S: `USER#${userId}` },
        },
      }),
    );

    if (!getResult.Items || getResult.Items.length === 0) {
      return {
        statusCode: 404,
        headers: getCorsHeaders(),
        body: JSON.stringify({ error: "Notification not found" }),
      };
    }

    const notification = unmarshall(getResult.Items[0]);

    // Update the notification
    await dynamodb.send(
      new UpdateItemCommand({
        TableName: process.env.NOTIFICATION_TABLE_NAME,
        Key: marshall({
          PK: notification.PK,
          SK: notification.SK,
        }),
        UpdateExpression: "SET isRead = :isRead, readStatus = :status, readAt = :readAt",
        ExpressionAttributeValues: marshall({
          ":isRead": true,
          ":status": "READ",
          ":readAt": new Date().toISOString(),
        }),
      }),
    );

    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return {
      statusCode: 500,
      headers: getCorsHeaders(),
      body: JSON.stringify({ error: "Failed to mark notification as read" }),
    };
  }
}

/**
 * Mark a specific notification as unread
 */
async function markNotificationAsUnread(userId, notificationId) {
  try {
    // First, get the notification to verify ownership and get the sort key
    const getResult = await dynamodb.send(
      new QueryCommand({
        TableName: process.env.NOTIFICATION_TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk AND GSI1SK = :sk",
        ExpressionAttributeValues: {
          ":pk": { S: `NOTIFICATION#${notificationId}` },
          ":sk": { S: `USER#${userId}` },
        },
      }),
    );

    if (!getResult.Items || getResult.Items.length === 0) {
      return {
        statusCode: 404,
        headers: getCorsHeaders(),
        body: JSON.stringify({ error: "Notification not found" }),
      };
    }

    const notification = unmarshall(getResult.Items[0]);

    // Update the notification
    await dynamodb.send(
      new UpdateItemCommand({
        TableName: process.env.NOTIFICATION_TABLE_NAME,
        Key: marshall({
          PK: notification.PK,
          SK: notification.SK,
        }),
        UpdateExpression: "SET isRead = :isRead, readStatus = :status REMOVE readAt",
        ExpressionAttributeValues: marshall({
          ":isRead": false,
          ":status": "UNREAD",
        }),
      }),
    );

    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error("Error marking notification as unread:", error);
    return {
      statusCode: 500,
      headers: getCorsHeaders(),
      body: JSON.stringify({ error: "Failed to mark notification as unread" }),
    };
  }
}

/**
 * Delete a specific notification
 */
async function deleteNotification(userId, notificationId) {
  try {
    // First, get the notification to verify ownership and get the sort key
    const getResult = await dynamodb.send(
      new QueryCommand({
        TableName: process.env.NOTIFICATION_TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk AND GSI1SK = :sk",
        ExpressionAttributeValues: {
          ":pk": { S: `NOTIFICATION#${notificationId}` },
          ":sk": { S: `USER#${userId}` },
        },
      }),
    );

    if (!getResult.Items || getResult.Items.length === 0) {
      return {
        statusCode: 404,
        headers: getCorsHeaders(),
        body: JSON.stringify({ error: "Notification not found" }),
      };
    }

    const notification = unmarshall(getResult.Items[0]);

    // Delete the notification
    await dynamodb.send(
      new DeleteItemCommand({
        TableName: process.env.NOTIFICATION_TABLE_NAME,
        Key: marshall({
          PK: notification.PK,
          SK: notification.SK,
        }),
      }),
    );

    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error("Error deleting notification:", error);
    return {
      statusCode: 500,
      headers: getCorsHeaders(),
      body: JSON.stringify({ error: "Failed to delete notification" }),
    };
  }
}

/**
 * Mark all notifications as read for a user
 */
async function markAllNotificationsAsRead(userId) {
  try {
    // Get all unread notifications for the user
    const result = await dynamodb.send(
      new QueryCommand({
        TableName: process.env.NOTIFICATION_TABLE_NAME,
        KeyConditionExpression: "PK = :pk",
        FilterExpression: "isRead = :isRead",
        ExpressionAttributeValues: {
          ":pk": { S: `USER#${userId}` },
          ":isRead": { BOOL: false },
        },
      }),
    );

    if (!result.Items || result.Items.length === 0) {
      return {
        statusCode: 200,
        headers: getCorsHeaders(),
        body: JSON.stringify({ updated: 0 }),
      };
    }

    // Update each notification
    const updatePromises = result.Items.map((item) => {
      const notification = unmarshall(item);
      return dynamodb.send(
        new UpdateItemCommand({
          TableName: process.env.NOTIFICATION_TABLE_NAME,
          Key: marshall({
            PK: notification.PK,
            SK: notification.SK,
          }),
          UpdateExpression: "SET isRead = :isRead, readStatus = :status, readAt = :readAt",
          ExpressionAttributeValues: marshall({
            ":isRead": true,
            ":status": "READ",
            ":readAt": new Date().toISOString(),
          }),
        }),
      );
    });

    await Promise.all(updatePromises);

    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify({ updated: result.Items.length }),
    };
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    return {
      statusCode: 500,
      headers: getCorsHeaders(),
      body: JSON.stringify({ error: "Failed to mark notifications as read" }),
    };
  }
}

/**
 * Get unread notification count for a user
 */
async function getUnreadCount(userId) {
  try {
    const result = await dynamodb.send(
      new QueryCommand({
        TableName: process.env.NOTIFICATION_TABLE_NAME,
        IndexName: "ReadStatusIndex",
        KeyConditionExpression: "PK = :pk AND readStatus = :status",
        ExpressionAttributeValues: {
          ":pk": { S: `USER#${userId}` },
          ":status": { S: "UNREAD" },
        },
        Select: "COUNT",
      }),
    );

    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify({ count: result.Count || 0 }),
    };
  } catch (error) {
    console.error("Error getting unread count:", error);
    return {
      statusCode: 500,
      headers: getCorsHeaders(),
      body: JSON.stringify({ error: "Failed to get unread count" }),
    };
  }
}

/**
 * Generate a unique notification ID
 */
function generateNotificationId() {
  return `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Get CORS headers for API responses
 */
function getCorsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "*",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none';",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  };
}
