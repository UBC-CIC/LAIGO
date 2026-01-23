const { initializeConnection } = require("./initializeConnection.js");
let { SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT, USER_POOL } = process.env;
const {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
} = require("@aws-sdk/client-cognito-identity-provider");

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
        if (!event.queryStringParameters?.cognito_id) {
          response = buildResponse(400, {
            error: "Missing required parameter: cognito_id",
          });
          break;
        }
        const students_cognito_id = event.queryStringParameters.cognito_id;

        try {
          // First, get the user_id for the given email
          const userResult = await sqlConnection`
            SELECT user_id FROM "users" WHERE cognito_id = ${students_cognito_id};
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
        if (!event.queryStringParameters?.cognito_id) {
          response = buildResponse(400, {
            error: "Missing required parameter: cognito_id",
          });
          break;
        }
        const review_cognito_id = event.queryStringParameters.cognito_id;

        try {
          const userIdResult = await sqlConnection`
            SELECT user_id FROM "users" WHERE cognito_id = ${review_cognito_id};
          `;

          if (userIdResult.length === 0) {
            response = buildResponse(404, {
              error: "Instructor user not found",
            });
            break;
          }

          // Query to get all cases sent for review
          const data = await sqlConnection`
            SELECT * FROM cases WHERE sent_to_review = true;
          `;

          response = buildResponse(200, data);
        } catch (err) {
          console.error("/instructor/cases_to_review error:", err);
          response = buildResponse(500, { error: "Internal server error" });
        }
        break;

      case "PUT /instructor/send_feedback":
        if (
          !event.queryStringParameters?.case_id ||
          !event.queryStringParameters?.instructor_id ||
          !event.body
        ) {
          response = buildResponse(400, {
            error:
              "Missing required parameters: case_id, instructor_id, or body",
          });
          break;
        }

        const { case_id, instructor_id } = event.queryStringParameters;
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
          const user = await sqlConnection`
            SELECT user_id FROM "users" WHERE cognito_id = ${instructor_id};
          `;

          if (user.length === 0) {
            response = buildResponse(404, {
              error: "Instructor user not found",
            });
            break;
          }
          const user_id = user[0].user_id;

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
        if (!event.queryStringParameters?.cognito_id) {
          response = buildResponse(400, {
            error: "Missing required parameter: cognito_id",
          });
          break;
        }
        const view_cognito_id = event.queryStringParameters.cognito_id;

        try {
          // Step 1: Get the instructor's user_id
          const userIdResult = await sqlConnection`
            SELECT user_id FROM "users" WHERE cognito_id = ${view_cognito_id};
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
