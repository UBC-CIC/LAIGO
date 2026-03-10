// const { v4: uuidv4 } = require('uuid')
const {
  initConnection,
  createResponse,
  parseBody,
  handleError,
  getSqlConnection,
} = require("./utils/utils");
const { Logger } = require("@aws-lambda-powertools/logger");
const logger = new Logger({ serviceName: "StudentFunction" });
let { MESSAGE_LIMIT, FILE_SIZE_LIMIT, TABLE_NAME } = process.env;
const {
  EventBridgeClient,
  PutEventsCommand,
} = require("@aws-sdk/client-eventbridge");

const eventBridge = new EventBridgeClient({});

// SQL connection will be set after init
let sqlConnection;

const routes = {
  "GET /student/profile": async (event, env) => {
    const { response, user, user_id, userEmail, sqlConnection } = env;
    // Return user metadata from database
    try {
      // Fetch additional fields from database
      const userDetails = await sqlConnection`
            SELECT user_id, user_email, first_name, last_name, roles, time_account_created, accepted_disclaimer
            FROM users
            WHERE user_id = ${user_id};
          `;

      if (userDetails.length === 0) {
        response.statusCode = 404;
        response.body = JSON.stringify({ error: "User not found" });
        return;
      }

      const userDetail = userDetails[0];
      response.statusCode = 200;
      response.body = JSON.stringify({
        userId: userDetail.user_id,
        email: userDetail.user_email,
        firstName: userDetail.first_name,
        lastName: userDetail.last_name,
        roles: userDetail.roles,
        timeAccountCreated: userDetail.time_account_created,
        acceptedDisclaimer: userDetail.accepted_disclaimer,
      });
    } catch (err) {
      handleError(err, response);
    }
  },
  "POST /student/create_user": async (event, env) => {
    const { response, user, user_id, sqlConnection } = env;
    if (event.queryStringParameters) {
      const { user_email, username, first_name, last_name } =
        event.queryStringParameters;

      try {
        // Sync user information based on user_id from authorizer
        const updatedUser = await sqlConnection`
                    UPDATE "users"
                    SET
                        username = ${username},
                        user_email = ${user_email},
                        first_name = ${first_name},
                        last_name = ${last_name},
                        last_sign_in = CURRENT_TIMESTAMP
                    WHERE user_id = ${user_id}
                    RETURNING *;
                `;
        if (updatedUser.length > 0) {
          response.body = JSON.stringify(updatedUser[0]);
        } else {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "User not found" });
        }
      } catch (err) {
        handleError(err, response);
      }
    } else {
      response.statusCode = 400;
      response.body = JSON.stringify({ error: "User data is required" });
    }
  },
  "GET /student/get_name": async (event, env) => {
    const { response, user, user_id, userEmail, sqlConnection } = env;
    if (event.queryStringParameters && event.queryStringParameters.user_email) {
      const user_email = event.queryStringParameters.user_email;
      try {
        // Retrieve roles for the user with the provided email
        const userData = await sqlConnection`
                  SELECT first_name
                  FROM "users"
                  WHERE user_email = ${user_email};
                `;
        console.log(userData);
        if (userData.length > 0) {
          response.body = JSON.stringify({ name: userData[0].first_name });
        } else {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "User not found" });
        }
      } catch (err) {
        handleError(err, response);
      }
    } else {
      response.statusCode = 400;
      response.body = JSON.stringify({ error: "User email is required" });
    }
  },
  "GET /student/get_summaries": async (event, env) => {
    const { response, user, user_id, userEmail, sqlConnection } = env;
    if (event.queryStringParameters && event.queryStringParameters.case_id) {
      const case_id = event.queryStringParameters.case_id;
      try {
        const data = await sqlConnection`
            SELECT * 
            FROM "summaries" WHERE case_id = ${case_id};
          `;

        // Check if data is empty and handle the case
        if (data.length === 0) {
          response.body = JSON.stringify({
            message: "No summaries generated yet",
          });
        } else {
          response.statusCode = 200; // OK
          response.body = JSON.stringify(data); // Ensure the data is always valid JSON
        }
      } catch (err) {
        handleError(err, response);
      }
    } else {
      response.statusCode = 400;
      response.body = JSON.stringify({ error: "User email is required" });
    }
  },
  "DELETE /student/delete_summary": async (event, env) => {
    const { response, user, user_id, userEmail, sqlConnection } = env;
    console.log(event);
    if (
      event.queryStringParameters != null &&
      event.queryStringParameters.summary_id
    ) {
      const summaryId = event.queryStringParameters.summary_id;

      try {
        await sqlConnection`
                    DELETE FROM "summaries"
                    WHERE summary_id = ${summaryId};
                `;

        response.statusCode = 200;
        response.body = JSON.stringify({
          message: "Summary deleted successfully",
        });
      } catch (err) {
        handleError(err, response);
      }
    } else {
      response.statusCode = 400;
      response.body = JSON.stringify({ error: "summary_id is required" });
    }
  },
  "GET /student/message_limit": async (event, env) => {
    const { response, user, user_id, userEmail, sqlConnection } = env;
    if (event.queryStringParameters && event.queryStringParameters.user_id) {
      try {
        console.log("Message limit name: ", MESSAGE_LIMIT);
        const { SSMClient, GetParameterCommand } =
          await import("@aws-sdk/client-ssm");

        const ssm = new SSMClient();

        console.log("Fetching message limit from SSM parameter store...");

        const result = await ssm.send(
          new GetParameterCommand({ Name: MESSAGE_LIMIT }),
        );

        console.log(
          "Message limit fetched successfully:",
          result.Parameter.Value,
        );

        response.statusCode = 200;
        response.body = JSON.stringify({ value: result.Parameter.Value });
      } catch (err) {
        console.error("Failed to fetch message limit:", err);
        handleError(err, response);
      }
    } else {
      response.statusCode = 400;
      response.body = JSON.stringify({ error: "User ID is required" });
    }
  },
  "GET /student/file_size_limit": async (event, env) => {
    const { response, user, user_id, userEmail, sqlConnection } = env;
    try {
      const { SSMClient, GetParameterCommand } =
        await import("@aws-sdk/client-ssm");
      const ssm = new SSMClient();

      const result = await ssm.send(
        new GetParameterCommand({ Name: FILE_SIZE_LIMIT }),
      );

      response.statusCode = 200;
      response.body = JSON.stringify({ value: result.Parameter.Value });
    } catch (err) {
      console.error("Failed to fetch file size limit:", err);
      handleError(err, response);
    }
  },
  "GET /student/get_cases": async (event, env) => {
    const { response, user, user_id, userEmail, sqlConnection } = env;
    // Use user_id from database user metadata
    try {
      const data = await sqlConnection`
            SELECT * 
            FROM "cases" WHERE student_id = ${user_id};
          `;

      // Check if data is empty and handle the case
      if (data.length === 0) {
        response.statusCode = 404; // Not Found
        response.body = JSON.stringify({ message: "No cases found" });
      } else {
        response.statusCode = 200; // OK
        response.body = JSON.stringify(data); // Ensure the data is always valid JSON
      }
    } catch (err) {
      response.statusCode = 500; // Internal server error
      console.error(err);
      response.body = JSON.stringify({ error: "Internal server error" });
    }
  },
  "GET /student/get_disclaimer": async (event, env) => {
    const { response, user, user_id, userEmail, sqlConnection } = env;
    // Use user_id from database user metadata
    try {
      // Fetch the latest active disclaimer
      const disclaimer = await sqlConnection`
            SELECT disclaimer_text, last_updated
            FROM disclaimers
            WHERE is_active = true
            ORDER BY last_updated DESC
            LIMIT 1;
          `;

      const userRecord = await sqlConnection`
            SELECT accepted_disclaimer
            FROM users
            WHERE user_id = ${user_id}
            LIMIT 1;
          `;

      if (!disclaimer.length) {
        response.statusCode = 404;
        response.body = JSON.stringify({
          message: "No disclaimer found",
        });
        return;
      }

      response.statusCode = 200;
      response.body = JSON.stringify({
        ...disclaimer[0],
        has_accepted: Boolean(userRecord[0]?.accepted_disclaimer),
      });
    } catch (err) {
      logger.error("Error fetching disclaimer:", err);
      handleError(err, response);
    }
  },
  "POST /student/accept_disclaimer": async (event, env) => {
    const { response, user, user_id, userEmail, sqlConnection } = env;
    // Use user_id from database user metadata
    try {
      // Update accepted_disclaimer to true
      await sqlConnection`
            UPDATE "users"
            SET accepted_disclaimer = true
            WHERE user_id = ${user_id};
          `;

      response.statusCode = 200;
      response.body = JSON.stringify({
        message: "Disclaimer accepted successfully",
      });
    } catch (err) {
      logger.error("Error accepting disclaimer:", err);
      handleError(err, response);
    }
  },
  "GET /student/recent_cases": async (event, env) => {
    const { response, user, user_id, userEmail, sqlConnection } = env;
    // Use user_id from database user metadata
    try {
      const data = await sqlConnection`
            SELECT * 
            FROM "cases"
            WHERE student_id = ${user_id}
            ORDER BY last_viewed DESC
            LIMIT 6;
          `;

      if (data.length === 0) {
        response.statusCode = 404;
        response.body = JSON.stringify({ message: "No cases found" });
      } else {
        response.statusCode = 200;
        response.body = JSON.stringify(data);
      }
    } catch (err) {
      handleError(err, response);
    }
  },
  "PUT /student/view_case": async (event, env) => {
    const { response, user, user_id, userEmail, sqlConnection } = env;
    if (event.queryStringParameters && event.queryStringParameters.case_id) {
      const case_id = event.queryStringParameters.case_id;

      try {
        await sqlConnection`
        UPDATE "cases"
        SET last_viewed = NOW()
        WHERE case_id = ${case_id};
      `;

        response.statusCode = 200;
        response.body = JSON.stringify({
          message: "Last viewed timestamp updated",
        });
      } catch (err) {
        logger.error(err);
        handleError(err, response);
      }
    } else {
      response.statusCode = 400;
      response.body = JSON.stringify({
        error: "Missing case_id or user_id",
      });
    }
  },
  "GET /student/get_transcriptions": async (event, env) => {
    const { response, user, user_id, userEmail, sqlConnection } = env;
    // Use user_id from database user metadata for ownership check
    if (event.queryStringParameters && event.queryStringParameters.case_id) {
      const caseId = event.queryStringParameters.case_id;

      try {
        // Get the case and its owner
        const caseResult = await sqlConnection`
              SELECT * FROM "cases" WHERE case_id = ${caseId};
            `;
        if (caseResult.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Case not found" });
          return;
        }
        const caseOwnerId = caseResult[0].student_id;

        // Check access — either owner OR an instructor of the owner
        let hasAccess = false;

        if (user_id === caseOwnerId) {
          hasAccess = true; // User owns the case
        } else {
          // Check if requesting user is an instructor of the student who owns the case
          const instructorCheck = await sqlConnection`
                SELECT 1 FROM "instructor_students"
                WHERE instructor_id = ${user_id} AND student_id = ${caseOwnerId};
              `;
          if (instructorCheck.length > 0) {
            hasAccess = true;
          }
        }

        if (!hasAccess) {
          response.statusCode = 403;
          response.body = JSON.stringify({ error: "Access denied" });
          return;
        }

        // Fetch transcriptions from audio_files for the case
        const transcriptions = await sqlConnection`
              SELECT audio_file_id, file_title, time_uploaded
              FROM "audio_files"
              WHERE case_id = ${caseId}
              ORDER BY time_uploaded DESC;
            `;

        // Return transcriptions
        response.statusCode = 200;
        response.body = JSON.stringify(transcriptions);
        return;
      } catch (err) {
        logger.error(err);
        handleError(err, response);
      }
    } else {
      response.statusCode = 400; // Bad Request
      response.body = JSON.stringify({ error: "case_id is required" });
    }
  },
  "GET /student/transcription": async (event, env) => {
    const { response, user, user_id, userEmail, sqlConnection } = env;
    // Use user_id from database user metadata for ownership check
    if (
      event.queryStringParameters &&
      event.queryStringParameters.audio_file_id
    ) {
      const audioFileId = event.queryStringParameters.audio_file_id;

      try {
        // Get case + owner for the audio file
        const caseResult = await sqlConnection`
              SELECT af.case_id, c.student_id AS case_owner_id
              FROM "audio_files" af
              JOIN "cases" c ON af.case_id = c.case_id
              WHERE af.audio_file_id = ${audioFileId};
            `;
        if (caseResult.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Audio file not found" });
          return;
        }

        const caseId = caseResult[0].case_id;
        const caseOwnerId = caseResult[0].case_owner_id;

        // Check access (owner or assigned instructor)
        let hasAccess = false;
        if (user_id === caseOwnerId) {
          hasAccess = true;
        } else {
          const instructorCheck = await sqlConnection`
                SELECT 1 FROM "instructor_students"
                WHERE instructor_id = ${user_id} AND student_id = ${caseOwnerId};
              `;
          if (instructorCheck.length > 0) {
            hasAccess = true;
          }
        }

        if (!hasAccess) {
          response.statusCode = 403;
          response.body = JSON.stringify({ error: "Access denied" });
          return;
        }

        // Fetch transcription
        const data = await sqlConnection`
              SELECT audio_text
              FROM "audio_files"
              WHERE audio_file_id = ${audioFileId};
            `;

        if (data.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({
            message: "Transcription not found",
          });
        } else {
          response.statusCode = 200;
          response.body = JSON.stringify(data[0]);
        }
      } catch (err) {
        logger.error(err);
        handleError(err, response);
      }
    } else {
      response.statusCode = 400;
      response.body = JSON.stringify({
        error: "Missing audio_file_id",
      });
    }
  },
  "GET /student/case_page": async (event, env) => {
    const { response, user, user_id, userEmail, sqlConnection } = env;
    // Use user_id from database user metadata for ownership check
    if (event.queryStringParameters && event.queryStringParameters.case_id) {
      const case_id = event.queryStringParameters.case_id;

      try {
        // Get the case and its owner
        const caseResult = await sqlConnection`
              SELECT * FROM "cases" WHERE case_id = ${case_id};
            `;
        if (caseResult.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Case not found" });
          return;
        }
        const caseOwnerId = caseResult[0].student_id;

        // Check access — either owner OR an instructor of the owner
        let hasAccess = false;

        if (user_id === caseOwnerId) {
          hasAccess = true; // User owns the case
        } else {
          // Check if requesting user is an instructor of the student who owns the case
          const instructorCheck = await sqlConnection`
                SELECT 1 FROM "instructor_students"
                WHERE instructor_id = ${user_id} AND student_id = ${caseOwnerId};
              `;
          if (instructorCheck.length > 0) {
            hasAccess = true;
          }
        }

        if (!hasAccess) {
          response.statusCode = 403;
          response.body = JSON.stringify({ error: "Access denied" });
          return;
        }

        // Fetch messages and summaries
        const messages = await sqlConnection`
              SELECT m.*, u.first_name, u.last_name
              FROM "messages" m
              LEFT JOIN "users" u ON m.instructor_id = u.user_id
              WHERE m.case_id = ${case_id};
            `;

        const summaries = await sqlConnection`
              SELECT * FROM "summaries" WHERE case_id = ${case_id};
            `;

        const combinedData = {
          caseData: caseResult[0],
          messages,
          summaries,
        };

        response.body = JSON.stringify(combinedData);
      } catch (err) {
        logger.error(err);
        handleError(err, response);
      }
    } else {
      response.statusCode = 400;
      response.body = JSON.stringify({
        error: "Case ID is required",
      });
    }
  },
  "GET /student/notifications": async (event, env) => {
    const { response, user, user_id, userEmail, sqlConnection } = env;
    // Use user_id from database user metadata
    try {
      const data = await sqlConnection`
            SELECT 
              c.case_id,
              c.case_title,
              m.message_content,
              m.time_sent,
              u.first_name||' '||u.last_name AS instructor_name
            FROM cases c
            JOIN messages m ON c.case_id = m.case_id
            JOIN users u ON m.instructor_id = u.user_id
            WHERE c.student_id = ${user_id}
            AND m.time_sent >= NOW() - INTERVAL '1 week'
            AND m.is_read = false
            ORDER BY m.time_sent DESC;
          `;

      // Check if data is empty and handle the case
      if (data.length === 0) {
        response.statusCode = 404;
        response.body = JSON.stringify({
          message: "No notifications found",
        });
      } else {
        response.statusCode = 200;
        response.body = JSON.stringify(data);
      }
    } catch (err) {
      handleError(err, response);
    }
  },
  "GET /student/instructors": async (event, env) => {
    const { response, user, user_id, userEmail, sqlConnection } = env;
    // Use user_id from database user metadata
    try {
      const data = await sqlConnection`
            SELECT 
              u.user_id AS instructor_id,
              u.first_name||' '||u.last_name AS instructor_name
            FROM instructor_students inst
            JOIN users u ON inst.instructor_id = u.user_id
            WHERE inst.student_id = ${user_id}
          `;

      if (data.length === 0) {
        response.statusCode = 404;
        response.body = JSON.stringify({
          message: "No instructors assigned to this user.",
        });
      } else {
        response.statusCode = 200;
        response.body = JSON.stringify(data);
      }
    } catch (err) {
      handleError(err, response);
    }
  },
  "GET /student/feedback": async (event, env) => {
    const { response, user, user_id, userEmail, sqlConnection } = env;
    // Use user_id from database user metadata for ownership check
    if (event.queryStringParameters && event.queryStringParameters.case_id) {
      const caseId = event.queryStringParameters.case_id;

      try {
        // Get case owner
        const caseResult = await sqlConnection`
              SELECT * FROM "cases" WHERE case_id = ${caseId};
            `;
        if (caseResult.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Case not found" });
          return;
        }
        const caseOwnerId = caseResult[0].student_id;

        // Check access (Owner or Assigned Instructor)
        let hasAccess = false;
        if (user_id === caseOwnerId) {
          hasAccess = true;
        } else {
          const instructorCheck = await sqlConnection`
                SELECT 1 FROM "instructor_students"
                WHERE instructor_id = ${user_id} AND student_id = ${caseOwnerId};
              `;
          if (instructorCheck.length > 0) {
            hasAccess = true;
          }
        }

        if (!hasAccess) {
          response.statusCode = 403;
          response.body = JSON.stringify({ error: "Access denied" });
          return;
        }

        // Fetch messages
        const messages = await sqlConnection`
              SELECT 
                m.message_id,
                m.message_content,
                m.time_sent,
                u.first_name,
                u.last_name
              FROM "messages" m
              LEFT JOIN "users" u ON m.instructor_id = u.user_id
              WHERE m.case_id = ${caseId}
              ORDER BY m.time_sent DESC;
            `;

        response.statusCode = 200;
        response.body = JSON.stringify(messages);
      } catch (err) {
        handleError(err, response);
      }
    } else {
      response.statusCode = 400;
      response.body = JSON.stringify({
        error: "Missing case_id",
      });
    }
  },
  "GET /student/disclaimer": async (event, env) => {
    const { response, user, user_id, sqlConnection } = env;
    try {
      const data = await sqlConnection`
            SELECT accepted_disclaimer
            FROM users
            WHERE user_id = ${user_id};
          `;

      if (data.length === 0) {
        response.statusCode = 404;
        response.body = JSON.stringify({
          message: "User not found",
        });
      } else {
        response.statusCode = 200;
        response.body = JSON.stringify(data);
      }
    } catch (err) {
      handleError(err, response);
    }
  },
  "POST /student/initialize_audio_file": async (event, env) => {
    const { response, user, user_id, userEmail, sqlConnection } = env;
    if (event.queryStringParameters) {
      const { audio_file_id, s3_file_path, case_id, title } =
        event.queryStringParameters;

      try {
        // Insert into audio_files table
        const insertResult = await sqlConnection`
                  INSERT INTO "audio_files" (audio_file_id, case_id, s3_file_path, file_title)
                  VALUES (${audio_file_id}, ${case_id}, ${s3_file_path}, ${title})
                  RETURNING *;
                `;

        response.statusCode = 200;
        response.body = JSON.stringify(insertResult[0]);
      } catch (err) {
        handleError(err, response);
      }
    }
  },
  "GET /student/message_counter": async (event, env) => {
    const { response, user, user_id, userEmail, sqlConnection } = env;
    // Use user_id from database user metadata
    try {
      const activityData = await sqlConnection`
            SELECT activity_counter, last_activity FROM "users" WHERE user_id = ${user_id};
          `;
      if (activityData.length > 0) {
        let activity_counter = parseInt(activityData[0].activity_counter, 10);
        const last_activity = activityData[0].last_activity;
        if (activity_counter > 0) {
          const currentTime = new Date();
          const lastActivityTime = new Date(last_activity);
          const timeDifference = Math.abs(currentTime - lastActivityTime);
          const hoursDifference = Math.floor(timeDifference / (1000 * 60 * 60));

          // Check if 24 hours have passed since the last activity
          if (hoursDifference >= 24) {
            await sqlConnection`
                  UPDATE "users" SET activity_counter = 0 WHERE user_id = ${user_id};
                `;

            activity_counter = 0;
          }
        }
        response.body = JSON.stringify({ activity_counter });
      } else {
        response.statusCode = 404;
        response.body = JSON.stringify({ error: "User not found" });
      }
    } catch (err) {
      handleError(err, response);
    }
  },
  "PUT /student/message_counter": async (event, env) => {
    const { response, user, user_id, userEmail, sqlConnection } = env;
    // Use user_id from database user metadata
    try {
      const activityData = await sqlConnection`
            SELECT activity_counter, last_activity FROM "users" WHERE user_id = ${user_id};
          `;

      if (activityData.length > 0) {
        let activity_counter = parseInt(activityData[0].activity_counter, 10);
        const last_activity = new Date(activityData[0].last_activity);
        const now = new Date();
        const hoursSinceLast = (now - last_activity) / (1000 * 60 * 60);

        if (hoursSinceLast >= 24) {
          // Reset counter and last_activity
          await sqlConnection`
                UPDATE "users" SET activity_counter = 1, last_activity = CURRENT_TIMESTAMP WHERE user_id = ${user_id};
              `;
          activity_counter = 1;
          // HARDCODED TO 10 RIGHT NOW, CHANGE TO BE FROM SECRETS MANAGER OR PARAM STORE
        } else if (activity_counter < 10) {
          // Increment counter
          await sqlConnection`
                UPDATE "users" SET activity_counter = activity_counter + 1 WHERE user_id = ${user_id};
              `;
          activity_counter += 1;
        } else {
          // Limit reached
          response.statusCode = 429;
          response.body = JSON.stringify({
            error: "Daily message limit reached",
          });
          return;
        }

        response.body = JSON.stringify({ activity_counter });
      } else {
        response.statusCode = 404;
        response.body = JSON.stringify({ error: "User not found" });
      }
    } catch (err) {
      handleError(err, response);
    }
  },
  "PUT /student/read_message": async (event, env) => {
    const { response, user, user_id, userEmail, sqlConnection } = env;
    if (event.queryStringParameters && event.queryStringParameters.message_id) {
      const message_id = event.queryStringParameters.message_id;
      try {
        // Mark the message as read
        await sqlConnection`
                  UPDATE messages SET is_read = true WHERE message_id = ${message_id};
                `;

        // Update case status only if current status is 'reviewed' (Review Feedback)
        await sqlConnection`
                  UPDATE cases
                  SET status = 'in_progress'
                  WHERE case_id = (
                    SELECT case_id FROM messages WHERE message_id = ${message_id}
                  )
                  AND status = 'reviewed';
                `;

        response.body = JSON.stringify({ success: true });
      } catch (err) {
        handleError(err, response);
      }
    } else {
      response.statusCode = 400;
      response.body = JSON.stringify({ error: "Message ID is required" });
    }
  },
  "PUT /student/disclaimer": async (event, env) => {
    const { response, user, user_id, userEmail, sqlConnection } = env;
    // Use user_id from database user metadata
    try {
      // Mark the disclaimer as accepted
      await sqlConnection`
            UPDATE users SET accepted_disclaimer = true WHERE user_id = ${user_id};
          `;

      response.body = JSON.stringify({ success: true });
    } catch (err) {
      handleError(err, response);
    }
    return;
    // NOTE: Duplicate GET /student/notifications case removed - already handled above
  },
  "GET /student/get_messages": async (event, env) => {
    const { response, user, user_id, userEmail, sqlConnection } = env;
    if (event.queryStringParameters && event.queryStringParameters.case_id) {
      const case_id = event.queryStringParameters.case_id;
      const sub_route = event.queryStringParameters.sub_route || "intake-facts";

      // Map sub_route to block_type enum (same as text_generation Lambda)
      const subrouteMap = {
        "intake-facts": "intake",
        "legal-analysis": "legal_analysis",
        "contrarian-analysis": "contrarian",
        "policy-context": "policy",
      };

      const block_type = subrouteMap[sub_route] || "intake";
      const session_id = `${case_id}-${block_type}`;

      try {
        logger.info(
          "Received case_id: ",
          case_id,
          " and sub_route: ",
          sub_route,
          " -> session_id: ",
          session_id,
        );

        // Initialize the DynamoDB client
        const {
          DynamoDBClient,
          QueryCommand,
        } = require("@aws-sdk/client-dynamodb");
        const ddbClient = new DynamoDBClient();

        // Query DynamoDB for messages with the constructed session_id
        const params = {
          TableName: TABLE_NAME,
          KeyConditionExpression: "SessionId = :session_id",
          ExpressionAttributeValues: {
            ":session_id": { S: session_id },
          },
        };

        const command = new QueryCommand(params);
        logger.info("Query params: ", params); // Log the params

        const data = await ddbClient.send(command);

        logger.info("Query results: ", data);

        if (data.Items && data.Items.length > 0) {
          const messages = data.Items[0].History.L;

          logger.info("MESSAGES: ", messages);
          const extractedMessages = messages.map((m) => ({
            type: m.M.data.M.type.S, // "human" or "ai"
            content: m.M.data.M.content.S, // Extracting only the message content
          }));

          logger.info("EXTRACTED MESSAGES: ", extractedMessages);
          if (messages.length > 0) {
            response.body = JSON.stringify(extractedMessages); // Return the message content as JSON
          } else {
            response.statusCode = 404;
            response.body = JSON.stringify({
              error: "No messages found for the case_id",
            });
          }
        } else {
          response.statusCode = 404;
          response.body = JSON.stringify({
            error: "No messages found for the case_id",
          });
        }
      } catch (err) {
        logger.error("Error occurred: ", err);
        handleError(err, response);
      }
    } else {
      logger.info("Case ID missing");
      response.statusCode = 400;
      response.body = JSON.stringify({ error: "Case ID is required" });
    }
  },
  "GET /student/notes": async (event, env) => {
    const { response, user, user_id, userEmail, sqlConnection } = env;
    // Use user_id from database user metadata for ownership check
    if (event.queryStringParameters && event.queryStringParameters.case_id) {
      const case_id = event.queryStringParameters.case_id;
      try {
        // Get case with student_notes and ownership check
        const caseData = await sqlConnection`
              SELECT student_notes, student_id FROM "cases" WHERE case_id = ${case_id};
            `;

        if (caseData.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Case not found" });
          return;
        }

        // Check ownership or instructor relationship
        const caseOwnerId = caseData[0].student_id;
        let hasAccess = false;
        if (user_id === caseOwnerId) {
          hasAccess = true;
        } else {
          const instructorCheck = await sqlConnection`
                SELECT 1 FROM "instructor_students"
                WHERE instructor_id = ${user_id} AND student_id = ${caseOwnerId};
              `;
          if (instructorCheck.length > 0) {
            hasAccess = true;
          }
        }

        if (!hasAccess) {
          response.statusCode = 403;
          response.body = JSON.stringify({ error: "Access denied" });
          return;
        }

        response.body = JSON.stringify({
          student_notes: caseData[0].student_notes,
        });
      } catch (err) {
        handleError(err, response);
      }
    } else {
      response.statusCode = 400;
      response.body = JSON.stringify({ error: "Case ID is required" });
    }
  },
  "PUT /student/notes": async (event, env) => {
    const { response, user, user_id, userEmail, sqlConnection } = env;
    // Use user_id from database user metadata for ownership check
    if (
      event.queryStringParameters != null &&
      event.queryStringParameters.case_id
    ) {
      const { case_id } = event.queryStringParameters;
      const { notes } = parseBody(event.body);

      try {
        // Get the case and verify ownership
        const caseResult = await sqlConnection`
              SELECT student_id FROM "cases" WHERE case_id = ${case_id};
            `;
        if (caseResult.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Case not found" });
          return;
        }

        // Only owner can update notes
        if (user_id !== caseResult[0].student_id) {
          response.statusCode = 403;
          response.body = JSON.stringify({
            error: "Access denied - only the case owner can update notes",
          });
          return;
        }

        await sqlConnection`
              UPDATE "cases"
              SET 
                student_notes = ${notes},
                last_updated = NOW()
              WHERE case_id = ${case_id}; 
            `;
        response.statusCode = 200;
        response.body = JSON.stringify({
          message: "Notes Updated Successfully",
        });
      } catch (err) {
        handleError(err, response);
      }
    } else {
      response.statusCode = 400;
      response.body = JSON.stringify({ error: "case_id is required" });
    }
  },
  "PUT /student/edit_case": async (event, env) => {
    const { response, user, user_id, userEmail, sqlConnection } = env;
    // Use user_id from database user metadata for ownership check
    if (
      event.queryStringParameters != null &&
      event.queryStringParameters.case_id
    ) {
      const { case_id } = event.queryStringParameters;

      const {
        case_title,
        case_type,
        case_description,
        status,
        jurisdiction,
        province,
        statute,
      } = parseBody(event.body);
      try {
        // Get the case and verify ownership
        const caseResult = await sqlConnection`
              SELECT student_id FROM "cases" WHERE case_id = ${case_id};
            `;
        if (caseResult.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Case not found" });
          return;
        }

        // Only owner can edit case
        if (user_id !== caseResult[0].student_id) {
          response.statusCode = 403;
          response.body = JSON.stringify({
            error: "Access denied - only the case owner can edit",
          });
          return;
        }

        await sqlConnection`
              UPDATE "cases"
              SET 
                case_title = ${case_title},
                case_type = ${case_type},
                case_description = ${case_description},
                status = ${status},
                jurisdiction = ${jurisdiction}, 
                province = ${province},
                statute = ${statute}
              WHERE case_id = ${case_id}; 
            `;
        response.statusCode = 200;
        response.body = JSON.stringify({
          message: "Case Updated Successfully",
        });
      } catch (err) {
        handleError(err, response);
      }
    } else {
      response.statusCode = 400;
      response.body = JSON.stringify({ error: "case_id is required" });
    }
  },
  "DELETE /student/delete_transcription": async (event, env) => {
    const { response, user, user_id, userEmail, sqlConnection } = env;
    // Use user_id from database user metadata for ownership check
    logger.info(event);
    if (
      event.queryStringParameters != null &&
      event.queryStringParameters.audio_file_id
    ) {
      const audioFileId = event.queryStringParameters.audio_file_id;

      try {
        // Get the audio file's case and verify ownership
        const audioResult = await sqlConnection`
              SELECT a.case_id, c.student_id 
              FROM "audio_files" a
              JOIN "cases" c ON a.case_id = c.case_id
              WHERE a.audio_file_id = ${audioFileId};
            `;
        if (audioResult.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Audio file not found" });
          return;
        }

        // Only owner can delete transcription
        if (user_id !== audioResult[0].student_id) {
          response.statusCode = 403;
          response.body = JSON.stringify({
            error:
              "Access denied - only the case owner can delete transcriptions",
          });
          return;
        }

        await sqlConnection`
              DELETE FROM "audio_files"
              WHERE audio_file_id = ${audioFileId};
            `;

        response.statusCode = 200;
        response.body = JSON.stringify({
          message: "Transcription deleted successfully",
        });
      } catch (err) {
        handleError(err, response);
      }
    } else {
      response.statusCode = 400;
      response.body = JSON.stringify({
        error: "audio_file_id is required",
      });
    }
  },
  "PUT /student/review_case": async (event, env) => {
    const { response, user, user_id, userEmail, sqlConnection } = env;
    // Use user_id from database user metadata for ownership check
    if (
      event.queryStringParameters != null &&
      event.queryStringParameters.case_id
    ) {
      const case_id = event.queryStringParameters.case_id;

      let reviewer_ids = [];
      try {
        if (event.body) {
          const parsedBody = parseBody(event.body);
          if (Array.isArray(parsedBody.reviewer_ids)) {
            reviewer_ids = parsedBody.reviewer_ids;
          }
        }
      } catch (e) {
        logger.warn("Failed to parse body for reviewer_ids", e);
      }

      try {
        // Get the case and its owner
        const caseResult = await sqlConnection`
              SELECT student_id FROM "cases" WHERE case_id = ${case_id};
            `;
        if (caseResult.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Case not found" });
          return;
        }
        const caseOwnerId = caseResult[0].student_id;

        // Check ownership — only owner can submit for review
        if (user_id !== caseOwnerId) {
          response.statusCode = 403;
          response.body = JSON.stringify({
            error: "Access denied - only the case owner can submit for review",
          });
          return;
        }

        await sqlConnection.begin(async (sql) => {
          // 1. Update case status
          await sql`
                UPDATE "cases"
                SET 
                    sent_to_review = true,
                    status = 'submitted'
                WHERE case_id = ${case_id}; 
              `;

          // 2. Insert reviewers if provided
          if (reviewer_ids.length > 0) {
            for (const reviewerId of reviewer_ids) {
              await sql`
                    INSERT INTO "case_reviewers" (case_id, reviewer_id)
                    VALUES (${case_id}, ${reviewerId})
                    ON CONFLICT (case_id, reviewer_id) DO NOTHING;
                  `;

              // Send notification to reviewer using database user_id
              const eventBusName = process.env.NOTIFICATION_EVENT_BUS_NAME;

              if (eventBusName) {
                try {
                  // Get student details for the message
                  const studentResult = await sql`
                         SELECT first_name, last_name FROM "users" WHERE user_id = ${user_id};
                      `;
                  const studentName =
                    studentResult.length > 0
                      ? `${studentResult[0].first_name} ${studentResult[0].last_name}`.trim()
                      : "A student";

                  // Get case title for the message
                  const caseTitleResult = await sql`
                          SELECT case_title FROM "cases" WHERE case_id = ${case_id};
                       `;
                  const caseTitle =
                    caseTitleResult.length > 0
                      ? caseTitleResult[0].case_title
                      : "Case";

                  const eventParams = {
                    Entries: [
                      {
                        Source: "notification.system",
                        DetailType: "Case Submitted",
                        Detail: JSON.stringify({
                          recipientId: reviewerId, // Database user_id, not idp_id
                          type: "case_submission",
                          title: "Case Submitted",
                          message: `${studentName} submitted case "${caseTitle}" for your review.`,
                          metadata: { caseId: case_id },
                        }),
                        EventBusName: eventBusName,
                      },
                    ],
                  };

                  await eventBridge.send(new PutEventsCommand(eventParams));
                  logger.info(`Notification sent to reviewer ${reviewerId}`);
                } catch (error) {
                  logger.error(
                    `Failed to send notification to reviewer ${reviewerId}:`,
                    error,
                  );
                }
              } else {
                logger.warn(
                  "NOTIFICATION_EVENT_BUS_NAME not set, skipping notification.",
                );
              }
            }
          }
        });

        response.statusCode = 200;
        response.body = JSON.stringify({
          message: "Case Updated and Reviewers Assigned Successfully",
        });
      } catch (err) {
        response.statusCode = 500;
        logger.error(err);
        response.body = JSON.stringify({
          error: "Internal server error",
        });
      }
    } else {
      response.statusCode = 400;
      response.body = JSON.stringify({ error: "case_id is required" });
    }
  },
  "PUT /student/archive_case": async (event, env) => {
    const { response, user, user_id, userEmail, sqlConnection } = env;
    // Use user_id from database user metadata for ownership check
    if (
      event.queryStringParameters != null &&
      event.queryStringParameters.case_id
    ) {
      const case_id = event.queryStringParameters.case_id;
      try {
        // Get the case and its owner
        const caseResult = await sqlConnection`
              SELECT student_id FROM "cases" WHERE case_id = ${case_id};
            `;
        if (caseResult.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Case not found" });
          return;
        }
        const caseOwnerId = caseResult[0].student_id;

        // Check ownership — only owner can archive
        if (user_id !== caseOwnerId) {
          response.statusCode = 403;
          response.body = JSON.stringify({
            error: "Access denied - only the case owner can archive",
          });
          return;
        }

        await sqlConnection`
              UPDATE "cases"
              SET status = 'archived'
              WHERE case_id = ${case_id}; 
            `;
        response.statusCode = 200;
        response.body = JSON.stringify({
          message: "Case Archived Successfully",
        });
      } catch (err) {
        response.statusCode = 500;
        logger.error(err);
        response.body = JSON.stringify({
          error: "Internal server error",
        });
      }
    } else {
      response.statusCode = 400;
      response.body = JSON.stringify({ error: "case_id is required" });
    }
  },
  "PUT /student/unarchive_case": async (event, env) => {
    const { response, user, user_id, userEmail, sqlConnection } = env;
    // Use user_id from database user metadata for ownership check
    if (
      event.queryStringParameters != null &&
      event.queryStringParameters.case_id
    ) {
      const case_id = event.queryStringParameters.case_id;
      try {
        // Get the case and its owner
        const caseResult = await sqlConnection`
              SELECT student_id FROM "cases" WHERE case_id = ${case_id};
            `;
        if (caseResult.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Case not found" });
          return;
        }
        const caseOwnerId = caseResult[0].student_id;

        // Check ownership — only owner can unarchive
        if (user_id !== caseOwnerId) {
          response.statusCode = 403;
          response.body = JSON.stringify({
            error: "Access denied - only the case owner can unarchive",
          });
          return;
        }

        await sqlConnection`
              UPDATE "cases"
              SET status = 'in_progress'
              WHERE case_id = ${case_id}; 
            `;
        response.statusCode = 200;
        response.body = JSON.stringify({
          message: "Case Unarchived Successfully",
        });
      } catch (err) {
        response.statusCode = 500;
        logger.error(err);
        response.body = JSON.stringify({
          error: "Internal server error",
        });
      }
    } else {
      response.statusCode = 400;
      response.body = JSON.stringify({ error: "case_id is required" });
    }
  },
  "PUT /student/complete_block": async (event, env) => {
    const { response, user, user_id, userEmail, sqlConnection } = env;
    // mark a block completed (formerly called "unlock")
    if (
      event.queryStringParameters != null &&
      event.queryStringParameters.case_id &&
      event.queryStringParameters.block_type
    ) {
      const { case_id, block_type } = event.queryStringParameters;

      try {
        // First, get current completed_blocks
        const caseData = await sqlConnection`
                SELECT completed_blocks FROM "cases" WHERE case_id = ${case_id};
              `;

        if (caseData.length === 0) {
          response.statusCode = 404;
          response.body = JSON.stringify({ error: "Case not found" });
          return;
        }

        const currentBlocks = caseData[0].completed_blocks || [];

        // Add the new block if not already present
        if (!currentBlocks.includes(block_type)) {
          const updatedBlocks = [...currentBlocks, block_type];

          await sqlConnection`
                  UPDATE "cases"
                  SET completed_blocks = ${updatedBlocks}
                  WHERE case_id = ${case_id};
                `;

          response.statusCode = 200;
          response.body = JSON.stringify({
            message: "Block marked completed successfully",
            completed_blocks: updatedBlocks,
          });
        } else {
          response.statusCode = 200;
          response.body = JSON.stringify({
            message: "Block already marked completed",
            completed_blocks: currentBlocks,
          });
        }
      } catch (err) {
        handleError(err, response);
      }
    } else {
      response.statusCode = 400;
      response.body = JSON.stringify({
        error: "case_id and block_type are required",
      });
    }
  },
};

exports.handler = async (event, context) => {
  logger.addContext(context);
  logger.info(event);

  // Extract userId and user metadata from authorization context
  const userId = event.requestContext?.authorizer?.userId || null;
  const email = event.requestContext?.authorizer?.email;
  const firstName = event.requestContext?.authorizer?.firstName;
  const lastName = event.requestContext?.authorizer?.lastName;
  const roles = JSON.parse(event.requestContext?.authorizer?.roles || "[]");

  if (!userId) {
    const resp = createResponse();
    resp.statusCode = 401;
    resp.body = JSON.stringify({
      error: "Unauthorized: Missing user identity",
    });
    return resp;
  }

  const response = createResponse();

  // Ensure DB initialized and obtain connection
  await initConnection();
  sqlConnection = getSqlConnection();

  // Build user object from context
  const user = {
    user_id: userId,
    email,
    first_name: firstName,
    last_name: lastName,
    roles,
  };

  // Extract user_id and email for use in queries
  const user_id = user.user_id;
  const userEmail = user.email;

  let data;
  try {
    const pathData = event.httpMethod + " " + event.resource;
    const env = {
      event,
      response,
      user,
      user_id,
      userEmail,
      sqlConnection,
    };

    const handlerConfig = routes[pathData];
    if (handlerConfig) {
      await handlerConfig(event, env);
    } else {
      response.statusCode = 404;
      response.body = JSON.stringify({ error: `Route not found: ${pathData}` });
    }
  } catch (error) {
    response.statusCode = 400;
    logger.error("Handler error", error);
    response.body = JSON.stringify(error.message);
  }
  logger.info("Student Response", { statusCode: response.statusCode });

  return response;
};
