const { initializeConnection } = require("./initializeConnection.js");
let { SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT, USER_POOL } = process.env;
const {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
} = require("@aws-sdk/client-cognito-identity-provider");
const {
  EventBridgeClient,
  PutEventsCommand,
} = require("@aws-sdk/client-eventbridge");

const eventBridgeClient = new EventBridgeClient({});

/**
 * Publish feedback notification event to EventBridge
 */
async function publishFeedbackNotificationEvent(
  caseId,
  studentId,
  instructorId,
  messageContent,
  caseTitle,
  instructorName,
) {
  try {
    const eventBusName = process.env.NOTIFICATION_EVENT_BUS_NAME;
    if (!eventBusName) {
      console.warn(
        "NOTIFICATION_EVENT_BUS_NAME not configured, skipping notification",
      );
      return;
    }

    const eventDetail = {
      type: "feedback",
      recipientId: studentId,
      title: `Feedback from ${instructorName} on ${caseTitle}`,
      message: messageContent,
      metadata: {
        caseId: caseId,
        caseName: caseTitle,
        instructorId: instructorId,
        instructorName: instructorName,
        feedbackPreview:
          messageContent.substring(0, 100) +
          (messageContent.length > 100 ? "..." : ""),
      },
      createdBy: instructorId,
    };

    const response = await eventBridgeClient.send(
      new PutEventsCommand({
        Entries: [
          {
            Source: "notification.system",
            DetailType: "Feedback Notification",
            Detail: JSON.stringify(eventDetail),
            EventBusName: eventBusName,
          },
        ],
      }),
    );

    console.log("Published feedback notification event:", response);
  } catch (error) {
    console.error("Error publishing feedback notification event:", error);
    // Don't fail the main operation if notification fails
  }
}

let sqlConnection = global.sqlConnection;

exports.handler = async (event) => {
  const cognito_id = event.requestContext.authorizer.userId;
  const client = new CognitoIdentityProviderClient();
  const userAttributesCommand = new AdminGetUserCommand({
    UserPoolId: USER_POOL,
    Username: cognito_id,
  });
  const userAttributesResponse = await client.send(userAttributesCommand);

  const emailAttr = userAttributesResponse.UserAttributes.find(
    (attr) => attr.Name === "email",
  );
  const userEmailAttribute = emailAttr ? emailAttr.Value : null;

  // Check for query string parameters

  const queryStringParams = event.queryStringParameters || {};
  const queryEmail = queryStringParams.email;
  const instructorEmail = queryStringParams.instructor_email;

  const isUnauthorized =
    (queryEmail && queryEmail !== userEmailAttribute) ||
    (instructorEmail && instructorEmail !== userEmailAttribute);

  if (isUnauthorized) {
    return {
      statusCode: 401,
      headers: {
        "Access-Control-Allow-Headers":
          "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "*",
      },
      body: JSON.stringify({ error: "Unauthorized" }),
    };
  }

  /* Helper to format responses */
  const buildResponse = (statusCode, body) => ({
    statusCode,
    headers: {
      "Access-Control-Allow-Headers":
        "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "*",
    },
    body: JSON.stringify(body),
  });

  // Initialize the database connection if not already initialized
  if (!sqlConnection) {
    try {
      await initializeConnection(SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT);
      sqlConnection = global.sqlConnection;
    } catch (err) {
      console.error("Database connection failed:", err);
      return buildResponse(500, {
        error: "Service unavailable (DB connection)",
      });
    }
  }

  let response;
  try {
    const pathData = event.httpMethod + " " + event.resource;

    switch (pathData) {
      case "GET /instructor/students":
        // SECURITY: Use trusted cognito_id from authorizer
        try {
          // First, get the user_id using trusted cognito_id from authorizer
          const userResult = await sqlConnection`
            SELECT user_id FROM "users" WHERE cognito_id = ${cognito_id};
          `;

          if (userResult.length === 0) {
            response = buildResponse(404, {
              error: "Instructor user not found",
            });
            break;
          }

          const userId = userResult[0].user_id;

          // Now, fetch the student details
          const data = await sqlConnection`
            SELECT u.student_id, u.first_name, u.last_name 
            FROM "instructor_students" i
            JOIN "users" u ON i.student_id = u.user_id
            WHERE i.instructor_id = ${userId};
          `;

          response = buildResponse(200, data);
        } catch (err) {
          console.error("/instructor/students error:", err);
          response = buildResponse(500, { error: "Internal server error" });
        }
        break;

      case "GET /instructor/cases_to_review":
        // SECURITY: Use trusted cognito_id from authorizer
        try {
          const userIdResult = await sqlConnection`
            SELECT user_id FROM "users" WHERE cognito_id = ${cognito_id};
          `;

          if (userIdResult.length === 0) {
            response = buildResponse(404, {
              error: "Instructor user not found",
            });
            break;
          }

          const instructorUserId = userIdResult[0].user_id;

          // Query to get cases explicitly assigned to this instructor for review
          const data = await sqlConnection`
            SELECT c.*, u.first_name, u.last_name 
            FROM cases c
            JOIN case_reviewers cr ON c.case_id = cr.case_id
            JOIN users u ON c.student_id = u.user_id
            WHERE cr.reviewer_id = ${instructorUserId}
            AND c.status = 'submitted'
            AND c.sent_to_review = true;
          `;

          response = buildResponse(200, data);
        } catch (err) {
          console.error("/instructor/cases_to_review error:", err);
          response = buildResponse(500, { error: "Internal server error" });
        }
        break;

      case "PUT /instructor/send_feedback":
        // SECURITY: Use trusted cognito_id from authorizer
        if (!event.queryStringParameters?.case_id || !event.body) {
          response = buildResponse(400, {
            error: "Missing required parameters: case_id or body",
          });
          break;
        }

        const { case_id } = event.queryStringParameters;
        let message_content;
        try {
          const parsedBody = JSON.parse(event.body);
          message_content = parsedBody.message_content;
        } catch (e) {
          response = buildResponse(400, { error: "Invalid JSON body" });
          break;
        }

        if (!message_content) {
          response = buildResponse(400, {
            error: "Missing message_content in body",
          });
          break;
        }

        try {
          // Get instructor user_id and name using trusted cognito_id from authorizer
          const user = await sqlConnection`
            SELECT user_id, first_name, last_name FROM "users" WHERE cognito_id = ${cognito_id};
          `;

          if (user.length === 0) {
            response = buildResponse(404, {
              error: "Instructor user not found",
            });
            break;
          }
          const user_id = user[0].user_id;
          const instructorName = `${user[0].first_name} ${user[0].last_name}`;

          // Get student_id, cognito_id, and case_title from the case and user tables
          const caseResult = await sqlConnection`
            SELECT c.student_id, c.case_title, u.cognito_id 
            FROM "cases" c
            JOIN "users" u ON c.student_id = u.user_id
            WHERE c.case_id = ${case_id};
          `;

          if (caseResult.length === 0) {
            response = buildResponse(404, {
              error: "Case not found",
            });
            break;
          }
          const student_id = caseResult[0].student_id;
          const student_cognito_id = caseResult[0].cognito_id;
          const case_title = caseResult[0].case_title;

          // Insert message
          await sqlConnection`
              INSERT INTO "messages" (
                  message_id, 
                  instructor_id, 
                  message_content, 
                  case_id, 
                  time_sent
              ) VALUES (
                  uuid_generate_v4(), 
                  ${user_id},
                  ${message_content}, 
                  ${case_id}, 
                  CURRENT_TIMESTAMP
              );
          `;

          // Update case status
          await sqlConnection`
            UPDATE "cases"
            SET 
              sent_to_review = false,
              status = 'reviewed'
            WHERE case_id = ${case_id};
          `;

          // Publish feedback notification event using student's cognito_id
          await publishFeedbackNotificationEvent(
            case_id,
            student_cognito_id,
            cognito_id,
            message_content,
            case_title,
            instructorName,
          );

          response = buildResponse(200, {
            message: "Feedback sent successfully",
          });
        } catch (err) {
          console.error("/instructor/send_feedback error:", err);
          response = buildResponse(500, { error: "Internal server error" });
        }
        break;

      case "GET /instructor/name":
        if (!event.queryStringParameters?.user_email) {
          response = buildResponse(400, {
            error: "Missing required parameter: user_email",
          });
          break;
        }
        const user_email = event.queryStringParameters.user_email;
        try {
          const userData = await sqlConnection`
            SELECT first_name FROM "users" WHERE user_email = ${user_email};
          `;

          if (userData.length > 0) {
            response = buildResponse(200, { name: userData[0].first_name });
          } else {
            response = buildResponse(404, { error: "User not found" });
          }
        } catch (err) {
          console.error("/instructor/name error:", err);
          response = buildResponse(500, { error: "Internal server error" });
        }
        break;

      case "GET /instructor/view_students":
        // SECURITY: Use trusted cognito_id from authorizer
        try {
          // Step 1: Get the instructor's user_id using trusted cognito_id
          const userIdResult = await sqlConnection`
            SELECT user_id FROM "users" WHERE cognito_id = ${cognito_id};
          `;

          if (userIdResult.length === 0) {
            response = buildResponse(404, {
              error: "Instructor user not found",
            });
            break;
          }
          const instructorId = userIdResult[0].user_id;

          // Step 2: Get student_ids associated with the instructor
          const studentIdsResult = await sqlConnection`
            SELECT student_id FROM "instructor_students" WHERE instructor_id = ${instructorId};
          `;

          const studentIds = studentIdsResult.map((row) => row.student_id);

          if (studentIds.length === 0) {
            response = buildResponse(200, []); // No students, return empty array
            break;
          }

          // Step 3: Get cases and student names
          const cases = await sqlConnection`
            SELECT 
              c.*, 
              u.first_name, 
              u.last_name 
            FROM "cases" c
            JOIN "users" u ON c.student_id = u.user_id
            WHERE c.student_id = ANY(${studentIds});
          `;

          response = buildResponse(200, cases);
        } catch (err) {
          console.error("/instructor/view_students error:", err);
          response = buildResponse(500, { error: "Internal server error" });
        }
        break;

      case "DELETE /instructor/delete_case":
        if (!event.queryStringParameters?.case_id) {
          response = buildResponse(400, {
            error: "Missing required parameter: case_id",
          });
          break;
        }
        const deleteCaseId = event.queryStringParameters.case_id;
        try {
          // Get instructor user_id from cognito_id
          const userResult = await sqlConnection`
            SELECT user_id FROM "users" WHERE cognito_id = ${cognito_id};
          `;
          if (userResult.length === 0) {
            response = buildResponse(404, {
              error: "Instructor user not found",
            });
            break;
          }
          const instructorId = userResult[0].user_id;

          // Get case owner
          const caseResult = await sqlConnection`
            SELECT student_id FROM "cases" WHERE case_id = ${deleteCaseId};
          `;
          if (caseResult.length === 0) {
            response = buildResponse(404, { error: "Case not found" });
            break;
          }
          const studentId = caseResult[0].student_id;

          // Check permission:
          // 1. Instructor is the owner (studentId === instructorId)
          // 2. Instructor is assigned to the student
          if (studentId !== instructorId) {
            const isAssigned = await sqlConnection`
              SELECT 1 FROM "instructor_students"
              WHERE instructor_id = ${instructorId} AND student_id = ${studentId};
            `;

            if (isAssigned.length === 0) {
              response = buildResponse(403, {
                error:
                  "Permission denied: Instructor is not assigned to this student and does not own this case.",
              });
              break;
            }
          }

          // Delete case
          await sqlConnection`
            DELETE FROM "cases" WHERE case_id = ${deleteCaseId};
          `;

          response = buildResponse(200, {
            message: "Case deleted successfully",
          });
        } catch (err) {
          console.error("/instructor/delete_case error:", err);
          response = buildResponse(500, { error: "Internal server error" });
        }
        break;

      case "DELETE /instructor/delete_feedback":
        if (!event.queryStringParameters?.message_id) {
          response = buildResponse(400, {
            error: "Missing required parameter: message_id",
          });
          break;
        }
        const deleteMessageId = event.queryStringParameters.message_id;
        try {
          // Get instructor user_id from cognito_id
          const userResult = await sqlConnection`
            SELECT user_id FROM "users" WHERE cognito_id = ${cognito_id};
          `;
          if (userResult.length === 0) {
            response = buildResponse(404, {
              error: "Instructor user not found",
            });
            break;
          }
          const instructorId = userResult[0].user_id;

          // Get message and its author
          const messageResult = await sqlConnection`
            SELECT instructor_id FROM "messages" WHERE message_id = ${deleteMessageId};
          `;
          if (messageResult.length === 0) {
            response = buildResponse(404, { error: "Feedback not found" });
            break;
          }
          const messageAuthorId = messageResult[0].instructor_id;

          // Check permission: Instructor must be the author of the message
          if (instructorId !== messageAuthorId) {
            response = buildResponse(403, {
              error:
                "Permission denied: You can only delete your own feedback.",
            });
            break;
          }

          // Delete message
          await sqlConnection`
            DELETE FROM "messages" WHERE message_id = ${deleteMessageId};
          `;

          response = buildResponse(200, {
            message: "Feedback deleted successfully",
          });
        } catch (err) {
          console.error("/instructor/delete_feedback error:", err);
          response = buildResponse(500, { error: "Internal server error" });
        }
        break;

      default:
        response = buildResponse(404, {
          error: `Route not found: ${pathData}`,
        });
        break;
    }
  } catch (error) {
    console.error("Critical Handler Error:", error);
    response = buildResponse(500, { error: "Critical internal server error" });
  }

  return response;
};
