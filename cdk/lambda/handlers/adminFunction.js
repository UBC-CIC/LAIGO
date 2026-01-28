const { initializeConnection } = require("./initializeConnection.js");
const {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
  AdminGetUserCommand,
} = require("@aws-sdk/client-cognito-identity-provider");

let {
  SM_DB_CREDENTIALS,
  RDS_PROXY_ENDPOINT,
  MESSAGE_LIMIT,
  FILE_SIZE_LIMIT,
  USER_POOL_ID,
  BEDROCK_LLM_PARAM,
  BEDROCK_TEMP_PARAM,
  BEDROCK_TOP_P_PARAM,
  BEDROCK_MAX_TOKENS_PARAM,
} = process.env;

// SQL conneciton from global variable at initializeConnection.js
let sqlConnectionTableCreator = global.sqlConnection;

exports.handler = async (event) => {
  const response = {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Headers":
        "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "*",
    },
    body: "",
  };

  // Initialize the database connection if not already initialized
  if (!sqlConnectionTableCreator) {
    await initializeConnection(SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT);
    sqlConnectionTableCreator = global.sqlConnection;
  }

  // Function to format student full names (lowercase and spaces replaced with "_")
  const formatNames = (name) => {
    return name.toLowerCase().replace(/\s+/g, "_");
  };

  let data;
  try {
    const pathData = event.httpMethod + " " + event.resource;
    switch (pathData) {
      case "GET /admin/instructors":
        try {
          // SQL query to fetch all users who are instructors
          const instructors = await sqlConnectionTableCreator`
            SELECT user_email, first_name, last_name, user_id
            FROM "users"
            WHERE 'instructor' = ANY(roles)
            ORDER BY last_name ASC;
          `;

          response.body = JSON.stringify(instructors);
        } catch (err) {
          console.error("Database error:", err);
          response.statusCode = 500;
          response.body = JSON.stringify({
            error: "Failed to fetch instructors",
          });
        }
        break;
      case "POST /admin/assign_instructor_to_student":
        // Check if the body contains the instructor and student IDs
        if (event.body) {
          try {
            const { instructor_id, student_email } = JSON.parse(event.body); // Parse the request body to access the JSON data

            if (!instructor_id || !student_email) {
              response.statusCode = 400;
              response.body = JSON.stringify({
                error: "Both instructor_id and student_email are required",
              });
              break;
            }

            // Look up student_id from email and verify it's a student
            const studentLookup = await sqlConnectionTableCreator`
              SELECT user_id, roles FROM "users" WHERE user_email = ${student_email};
            `;

            if (studentLookup.length === 0) {
              response.statusCode = 404;
              response.body = JSON.stringify({
                error: "Student not found with that email.",
              });
              break;
            }

            const student = studentLookup[0];
            /* Optional: Verify user is a student? 
               Usually good, but maybe an 'admin' or 'instructor' could be a student of another instructor?
               For now, let's allow it, or strictly check roles. The Requirement implies 'assign students'.
             */

            // Perform the database insertion
            const assignment = await sqlConnectionTableCreator`
                INSERT INTO "instructor_students" (instructor_id, student_id)
                VALUES ( ${instructor_id}, ${student.user_id})
                ON CONFLICT (instructor_id, student_id) DO NOTHING;
              `;

            // Check if inserted? Postgres doesn't return count easily in all drivers with simple query unless returning.
            // But 'DO NOTHING' prevents error.

            response.statusCode = 200;
            response.body = JSON.stringify({
              message: "Instructor and student linked successfully.",
            });
          } catch (err) {
            response.statusCode = 500;
            console.error(err);
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Request body is missing" });
        }
        break;

      case "DELETE /admin/assign_instructor_to_student":
        if (event.queryStringParameters) {
          try {
            const { instructor_id, student_id } = event.queryStringParameters;

            if (!instructor_id || !student_id) {
              response.statusCode = 400;
              response.body = JSON.stringify({
                error: "Both instructor_id and student_id are required",
              });
              break;
            }

            await sqlConnectionTableCreator`
              DELETE FROM "instructor_students"
              WHERE instructor_id = ${instructor_id} AND student_id = ${student_id};
            `;

            response.statusCode = 200;
            response.body = JSON.stringify({
              message: "Student unassigned successfully.",
            });
          } catch (err) {
            response.statusCode = 500;
            console.error(err);
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Query parameters missing" });
        }
        break;
      case "GET /admin/students":
        try {
          // SQL query to fetch all users who are instructors
          const students = await sqlConnectionTableCreator`
            SELECT user_email, first_name, last_name, user_id
            FROM "users"
            WHERE 'student' = ANY(roles)
            ORDER BY last_name ASC;
          `;

          response.body = JSON.stringify(students);
        } catch (err) {
          console.error("Database error:", err);
          response.statusCode = 500;
          response.body = JSON.stringify({ error: "Failed to fetch students" });
        }
        break;
      case "POST /admin/prompt":
        try {
          console.log("System prompt creation initiated");

          if (!event.body) throw new Error("Request body is missing");

          const { category, block_type, prompt_text, version_name, author_id } =
            JSON.parse(event.body);

          if (!category || !block_type || !prompt_text)
            throw new Error(
              "Missing required fields: category, block_type, and prompt_text are required",
            );

          // Get the next version number for this category/block_type combination
          const versionCheck = await sqlConnectionTableCreator`
            SELECT COALESCE(MAX(version_number), 0) + 1 as next_version
            FROM "prompt_versions"
            WHERE category = ${category} AND block_type = ${block_type};
          `;

          const nextVersion = versionCheck[0].next_version;

          // Insert new prompt into prompt_versions table
          const insertPrompt = await sqlConnectionTableCreator`
            INSERT INTO "prompt_versions" (category, block_type, version_number, version_name, prompt_text, author_id, is_active)
            VALUES (${category}, ${block_type}, ${nextVersion}, ${
              version_name || null
            }, ${prompt_text}, ${author_id || null}, false)
            RETURNING *;
          `;

          response.body = JSON.stringify(insertPrompt[0]);
        } catch (err) {
          response.statusCode = 500;
          console.error("Error inserting prompt version:", err);
          response.body = JSON.stringify({
            error: err.message || "Internal server error",
          });
        }
        break;
      case "PUT /admin/prompt":
        try {
          console.log("Prompt version update initiated");

          if (!event.body) throw new Error("Request body is missing");

          const { prompt_version_id, prompt_text, version_name } = JSON.parse(
            event.body,
          );

          if (!prompt_version_id)
            throw new Error("Missing required field: prompt_version_id");

          if (!prompt_text && !version_name)
            throw new Error(
              "At least one field to update is required: prompt_text or version_name",
            );

          // Check if prompt exists
          const existingPrompt = await sqlConnectionTableCreator`
            SELECT prompt_version_id FROM "prompt_versions"
            WHERE prompt_version_id = ${prompt_version_id};
          `;

          if (existingPrompt.length === 0) {
            response.statusCode = 404;
            throw new Error("Prompt version not found");
          }

          // Update the prompt
          const updateResult = await sqlConnectionTableCreator`
            UPDATE "prompt_versions"
            SET 
              prompt_text = COALESCE(${prompt_text || null}, prompt_text),
              version_name = COALESCE(${version_name || null}, version_name)
            WHERE prompt_version_id = ${prompt_version_id}
            RETURNING *;
          `;

          response.body = JSON.stringify(updateResult[0]);
        } catch (err) {
          if (response.statusCode === 200) {
            response.statusCode = 500;
          }
          console.error("Error updating prompt version:", err);
          response.body = JSON.stringify({
            error: err.message || "Internal server error",
          });
        }
        break;
      case "GET /admin/prompt":
        try {
          // Fetch ALL prompt versions, ordered by category, block_type, and version
          const prompts = await sqlConnectionTableCreator`
            SELECT 
              pv.prompt_version_id,
              pv.category,
              pv.block_type,
              pv.version_number,
              pv.version_name,
              pv.prompt_text,
              pv.author_id,
              pv.time_created,
              pv.is_active,
              CONCAT(u.first_name, ' ', u.last_name) AS author_name
            FROM "prompt_versions" pv
            LEFT JOIN "users" u ON pv.author_id = u.user_id
            ORDER BY pv.category, pv.block_type, pv.version_number DESC;
          `;

          response.body = JSON.stringify(prompts);
        } catch (err) {
          response.statusCode = 500;
          console.error("Error fetching prompt versions:", err);
          response.body = JSON.stringify({
            error: err.message || "Internal server error",
          });
        }
        break;
      case "GET /admin/prompt/active":
        try {
          // Fetch only active prompts
          const activePrompts = await sqlConnectionTableCreator`
            SELECT 
              prompt_version_id,
              category,
              block_type,
              version_number,
              version_name,
              prompt_text,
              time_created
            FROM "prompt_versions"
            WHERE is_active = true
            ORDER BY category, block_type;
          `;

          response.body = JSON.stringify(activePrompts);
        } catch (err) {
          response.statusCode = 500;
          console.error("Error fetching active prompts:", err);
          response.body = JSON.stringify({
            error: err.message || "Internal server error",
          });
        }
        break;
      case "POST /admin/prompt/activate":
        try {
          if (!event.body) throw new Error("Request body is missing");

          const { prompt_version_id } = JSON.parse(event.body);

          if (!prompt_version_id)
            throw new Error("Missing required field: prompt_version_id");

          // Get the category and block_type of the prompt to activate
          const promptToActivate = await sqlConnectionTableCreator`
            SELECT category, block_type
            FROM "prompt_versions"
            WHERE prompt_version_id = ${prompt_version_id};
          `;

          if (promptToActivate.length === 0) {
            throw new Error("Prompt version not found");
          }

          const { category, block_type } = promptToActivate[0];

          // Begin transaction: deactivate current active prompt and activate new one
          await sqlConnectionTableCreator.begin(async (sql) => {
            // Deactivate any currently active prompt for this category/block_type
            await sql`
              UPDATE "prompt_versions"
              SET is_active = false
              WHERE category = ${category} 
                AND block_type = ${block_type} 
                AND is_active = true;
            `;

            // Activate the selected prompt
            await sql`
              UPDATE "prompt_versions"
              SET is_active = true
              WHERE prompt_version_id = ${prompt_version_id};
            `;
          });

          response.body = JSON.stringify({
            message: "Prompt activated successfully",
            category,
            block_type,
          });
        } catch (err) {
          response.statusCode = 500;
          console.error("Error activating prompt:", err);
          response.body = JSON.stringify({
            error: err.message || "Internal server error",
          });
        }
        break;

      case "DELETE /admin/prompt":
        try {
          if (
            !event.queryStringParameters ||
            !event.queryStringParameters.prompt_version_id
          ) {
            throw new Error(
              "Missing required query parameter: prompt_version_id",
            );
          }

          const prompt_version_id =
            event.queryStringParameters.prompt_version_id;

          // Get the prompt to verify it exists and check if it's active
          const promptToDelete = await sqlConnectionTableCreator`
            SELECT category, block_type, is_active
            FROM "prompt_versions"
            WHERE prompt_version_id = ${prompt_version_id};
          `;

          if (promptToDelete.length === 0) {
            response.statusCode = 404;
            throw new Error("Prompt version not found");
          }

          const { category, block_type, is_active } = promptToDelete[0];

          // Prevent deletion of active prompts
          if (is_active) {
            response.statusCode = 400;
            throw new Error(
              "Cannot delete an active prompt. Please deactivate it first.",
            );
          }

          // Delete the prompt
          await sqlConnectionTableCreator`
            DELETE FROM "prompt_versions"
            WHERE prompt_version_id = ${prompt_version_id};
          `;

          response.body = JSON.stringify({
            message: "Prompt deleted successfully",
            category,
            block_type,
          });
        } catch (err) {
          if (response.statusCode === 200) {
            response.statusCode = 500;
          }
          console.error("Error deleting prompt:", err);
          response.body = JSON.stringify({
            error: err.message || "Internal server error",
          });
        }
        break;

      case "GET /admin/ai_config":
        try {
          const { SSMClient, GetParameterCommand } =
            await import("@aws-sdk/client-ssm");
          const ssm = new SSMClient();

          const [llmRes, tempRes, topPRes, maxTokensRes] = await Promise.all([
            ssm.send(new GetParameterCommand({ Name: BEDROCK_LLM_PARAM })),
            ssm.send(new GetParameterCommand({ Name: BEDROCK_TEMP_PARAM })),
            ssm.send(new GetParameterCommand({ Name: BEDROCK_TOP_P_PARAM })),
            ssm.send(
              new GetParameterCommand({ Name: BEDROCK_MAX_TOKENS_PARAM }),
            ),
          ]);

          response.statusCode = 200;
          response.body = JSON.stringify({
            bedrock_llm_id: llmRes.Parameter.Value,
            temperature: tempRes.Parameter.Value,
            top_p: topPRes.Parameter.Value,
            max_tokens: maxTokensRes.Parameter.Value,
          });
        } catch (err) {
          console.error("Failed to fetch AI config:", err);
          response.statusCode = 500;
          response.body = JSON.stringify({ error: "Internal server error" });
        }
        break;

      case "POST /admin/ai_config":
        try {
          const { SSMClient, PutParameterCommand } =
            await import("@aws-sdk/client-ssm");
          const ssm = new SSMClient();
          const body = JSON.parse(event.body);

          const promises = [];
          if (body.bedrock_llm_id) {
            promises.push(
              ssm.send(
                new PutParameterCommand({
                  Name: BEDROCK_LLM_PARAM,
                  Value: String(body.bedrock_llm_id),
                  Overwrite: true,
                  Type: "String",
                }),
              ),
            );
          }
          if (body.temperature) {
            promises.push(
              ssm.send(
                new PutParameterCommand({
                  Name: BEDROCK_TEMP_PARAM,
                  Value: String(body.temperature),
                  Overwrite: true,
                  Type: "String",
                }),
              ),
            );
          }
          if (body.top_p) {
            promises.push(
              ssm.send(
                new PutParameterCommand({
                  Name: BEDROCK_TOP_P_PARAM,
                  Value: String(body.top_p),
                  Overwrite: true,
                  Type: "String",
                }),
              ),
            );
          }
          if (body.max_tokens) {
            promises.push(
              ssm.send(
                new PutParameterCommand({
                  Name: BEDROCK_MAX_TOKENS_PARAM,
                  Value: String(body.max_tokens),
                  Overwrite: true,
                  Type: "String",
                }),
              ),
            );
          }

          await Promise.all(promises);

          response.statusCode = 200;
          response.body = JSON.stringify({ success: true });
        } catch (err) {
          console.error("Failed to update AI config:", err);
          response.statusCode = 500;
          response.body = JSON.stringify({ error: "Internal server error" });
        }
        break;

      case "GET /admin/message_limit":
        try {
          console.log("Message limit name:", process.env.MESSAGE_LIMIT);
          const { SSMClient, GetParameterCommand } =
            await import("@aws-sdk/client-ssm");

          const ssm = new SSMClient();

          console.log("Fetching admin message limit from SSM...");
          const result = await ssm.send(
            new GetParameterCommand({ Name: process.env.MESSAGE_LIMIT }),
          );

          console.log(
            "✅ Admin message limit fetched:",
            result.Parameter.Value,
          );

          response.statusCode = 200;
          response.body = JSON.stringify({ value: result.Parameter.Value });
        } catch (err) {
          console.error("❌ Failed to fetch message limit:", err);
          response.statusCode = 500;
          response.body = JSON.stringify({ error: "Internal server error" });
        }
        break;

      case "POST /admin/message_limit":
        try {
          const { SSMClient, PutParameterCommand } =
            await import("@aws-sdk/client-ssm");
          const ssm = new SSMClient();

          const body = JSON.parse(event.body);
          const newValue = body?.value;

          if (typeof newValue !== "string" && typeof newValue !== "number") {
            response.statusCode = 400;
            response.body = JSON.stringify({
              error: "Missing or invalid 'value' in request body",
            });
            break;
          }

          await ssm.send(
            new PutParameterCommand({
              Name: process.env.MESSAGE_LIMIT,
              Value: String(newValue),
              Overwrite: true,
              Type: "String",
            }),
          );

          console.log("✅ Message limit updated successfully.");

          response.statusCode = 200;
          response.body = JSON.stringify({ success: true, value: newValue });
        } catch (err) {
          console.error("❌ Failed to update message limit:", err);
          response.statusCode = 500;
          response.body = JSON.stringify({ error: "Internal server error" });
        }
        break;
      case "GET /admin/file_size_limit":
        try {
          const { SSMClient, GetParameterCommand } =
            await import("@aws-sdk/client-ssm");
          const ssm = new SSMClient();

          const result = await ssm.send(
            new GetParameterCommand({ Name: process.env.FILE_SIZE_LIMIT }),
          );

          response.statusCode = 200;
          response.body = JSON.stringify({ value: result.Parameter.Value });
        } catch (err) {
          console.error("Failed to fetch file size limit:", err);
          response.statusCode = 500;
          response.body = JSON.stringify({ error: "Internal server error" });
        }
        break;

      case "POST /admin/file_size_limit":
        try {
          const { SSMClient, PutParameterCommand } =
            await import("@aws-sdk/client-ssm");
          const ssm = new SSMClient();

          const body = JSON.parse(event.body);
          const newValue = body?.value;

          if (!newValue) {
            response.statusCode = 400;
            response.body = JSON.stringify({
              error: "Missing 'value' in request body",
            });
            break;
          }

          await ssm.send(
            new PutParameterCommand({
              Name: process.env.FILE_SIZE_LIMIT,
              Value: String(newValue),
              Overwrite: true,
              Type: "String",
            }),
          );

          response.statusCode = 200;
          response.body = JSON.stringify({ success: true, value: newValue });
        } catch (err) {
          console.error("Failed to update file size limit:", err);
          response.statusCode = 500;
          response.body = JSON.stringify({ error: "Internal server error" });
        }
        break;
      case "GET /student/file_size_limit":
        try {
          const { SSMClient, GetParameterCommand } =
            await import("@aws-sdk/client-ssm");
          const ssm = new SSMClient();

          const result = await ssm.send(
            new GetParameterCommand({ Name: process.env.FILE_SIZE_LIMIT }),
          );

          response.statusCode = 200;
          response.body = JSON.stringify({ value: result.Parameter.Value });
        } catch (err) {
          console.error("Failed to fetch file size limit:", err);
          response.statusCode = 500;
          response.body = JSON.stringify({ error: "Internal server error" });
        }
        break;

      case "GET /admin/instructorStudents":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.instructor_id
        ) {
          const { instructor_id } = event.queryStringParameters;

          // SQL query to fetch all students for a given instructor
          const student_ids = await sqlConnectionTableCreator`
              SELECT u.user_id, u.first_name, u.last_name, u.user_email
  FROM instructor_students AS ist
  JOIN users AS u
  ON ist.student_id = u.user_id
  WHERE ist.instructor_id = ${instructor_id};
            `;

          response.body = JSON.stringify(student_ids);
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "instructor_email is required",
          });
        }
        break;
      case "POST /admin/disclaimer":
        try {
          console.log("Disclaimer creation initiated");

          if (!event.body) throw new Error("Request body is missing");

          const { disclaimer_text, version_name, author_id } = JSON.parse(
            event.body,
          );

          if (!disclaimer_text)
            throw new Error("Missing 'disclaimer_text' in request body");

          // Get the next version number
          const versionCheck = await sqlConnectionTableCreator`
            SELECT COALESCE(MAX(version_number), 0) + 1 as next_version
            FROM "disclaimers";
          `;

          const nextVersion = versionCheck[0].next_version;

          // Insert new disclaimer with versioning
          const insertResult = await sqlConnectionTableCreator`
            INSERT INTO "disclaimers" (disclaimer_text, version_number, version_name, author_id, is_active)
            VALUES (${disclaimer_text}, ${nextVersion}, ${version_name || null}, ${author_id || null}, false)
            RETURNING *;
          `;

          response.body = JSON.stringify(insertResult[0]);
        } catch (err) {
          response.statusCode = 500;
          console.error("Error inserting disclaimer:", err);
          response.body = JSON.stringify({
            error: err.message || "Internal server error",
          });
        }
        break;
      case "GET /admin/disclaimer":
        try {
          // Fetch ALL disclaimers with author info, ordered by version
          const result = await sqlConnectionTableCreator`
            SELECT 
              d.disclaimer_id,
              d.disclaimer_text,
              d.version_number,
              d.version_name,
              d.author_id,
              d.time_created,
              d.last_updated,
              d.is_active,
              CONCAT(u.first_name, ' ', u.last_name) AS author_name
            FROM "disclaimers" d
            LEFT JOIN "users" u ON d.author_id = u.user_id
            ORDER BY d.version_number DESC;
          `;
          response.body = JSON.stringify(result);
        } catch (err) {
          console.error("Error fetching disclaimers:", err);
          response.statusCode = 500;
          response.body = JSON.stringify({
            error: "Failed to fetch disclaimers",
          });
        }
        break;

      case "PUT /admin/disclaimer":
        try {
          console.log("Disclaimer version update initiated");

          if (!event.body) throw new Error("Request body is missing");

          const { disclaimer_id, disclaimer_text, version_name } = JSON.parse(
            event.body,
          );

          if (!disclaimer_id)
            throw new Error("Missing required field: disclaimer_id");

          if (!disclaimer_text && !version_name)
            throw new Error(
              "At least one field to update is required: disclaimer_text or version_name",
            );

          // Check if disclaimer exists
          const existingDisclaimer = await sqlConnectionTableCreator`
            SELECT disclaimer_id FROM "disclaimers"
            WHERE disclaimer_id = ${disclaimer_id};
          `;

          if (existingDisclaimer.length === 0) {
            response.statusCode = 404;
            throw new Error("Disclaimer version not found");
          }

          // Update the disclaimer
          const updateResult = await sqlConnectionTableCreator`
            UPDATE "disclaimers"
            SET 
              disclaimer_text = COALESCE(${disclaimer_text || null}, disclaimer_text),
              version_name = COALESCE(${version_name || null}, version_name),
              last_updated = now()
            WHERE disclaimer_id = ${disclaimer_id}
            RETURNING *;
          `;

          response.body = JSON.stringify(updateResult[0]);
        } catch (err) {
          if (response.statusCode === 200) {
            response.statusCode = 500;
          }
          console.error("Error updating disclaimer:", err);
          response.body = JSON.stringify({
            error: err.message || "Internal server error",
          });
        }
        break;

      case "DELETE /admin/disclaimer":
        try {
          if (
            !event.queryStringParameters ||
            !event.queryStringParameters.disclaimer_id
          ) {
            throw new Error("Missing required query parameter: disclaimer_id");
          }

          const disclaimer_id = event.queryStringParameters.disclaimer_id;

          // Get the disclaimer to verify it exists and check if it's active
          const disclaimerToDelete = await sqlConnectionTableCreator`
            SELECT is_active
            FROM "disclaimers"
            WHERE disclaimer_id = ${disclaimer_id};
          `;

          if (disclaimerToDelete.length === 0) {
            response.statusCode = 404;
            throw new Error("Disclaimer version not found");
          }

          const { is_active } = disclaimerToDelete[0];

          // Prevent deletion of active disclaimer
          if (is_active) {
            response.statusCode = 400;
            throw new Error(
              "Cannot delete an active disclaimer. Please activate another first.",
            );
          }

          // Delete the disclaimer
          await sqlConnectionTableCreator`
            DELETE FROM "disclaimers"
            WHERE disclaimer_id = ${disclaimer_id};
          `;

          response.body = JSON.stringify({
            message: "Disclaimer deleted successfully",
          });
        } catch (err) {
          if (response.statusCode === 200) {
            response.statusCode = 500;
          }
          console.error("Error deleting disclaimer:", err);
          response.body = JSON.stringify({
            error: err.message || "Internal server error",
          });
        }
        break;

      case "POST /admin/disclaimer/activate":
        try {
          if (!event.body) throw new Error("Request body is missing");

          const { disclaimer_id } = JSON.parse(event.body);

          if (!disclaimer_id)
            throw new Error("Missing required field: disclaimer_id");

          // Check if disclaimer exists
          const disclaimerToActivate = await sqlConnectionTableCreator`
            SELECT disclaimer_id
            FROM "disclaimers"
            WHERE disclaimer_id = ${disclaimer_id};
          `;

          if (disclaimerToActivate.length === 0) {
            throw new Error("Disclaimer version not found");
          }

          // Begin transaction: deactivate current active disclaimer and activate new one
          await sqlConnectionTableCreator.begin(async (sql) => {
            // Deactivate any currently active disclaimer
            await sql`
              UPDATE "disclaimers"
              SET is_active = false
              WHERE is_active = true;
            `;

            // Activate the selected disclaimer
            await sql`
              UPDATE "disclaimers"
              SET is_active = true
              WHERE disclaimer_id = ${disclaimer_id};
            `;
          });

          response.body = JSON.stringify({
            message: "Disclaimer activated successfully",
          });
        } catch (err) {
          response.statusCode = 500;
          console.error("Error activating disclaimer:", err);
          response.body = JSON.stringify({
            error: err.message || "Internal server error",
          });
        }
        break;

      case "POST /admin/elevate_instructor":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.email
        ) {
          const instructorEmail = event.queryStringParameters.email;

          try {
            // Check if the user exists in database
            const existingUser = await sqlConnectionTableCreator`
              SELECT * FROM "users"
              WHERE user_email = ${instructorEmail};
            `;

            if (existingUser.length === 0) {
              // User does not exist in database - return error
              response.statusCode = 404;
              response.body = JSON.stringify({
                error:
                  "User not found. Only existing users can be elevated to instructor.",
              });
              break;
            }

            const userRoles = existingUser[0].roles;
            const userId = existingUser[0].user_id;

            // Check if the user is already an instructor or admin
            if (
              userRoles.includes("instructor") ||
              userRoles.includes("admin")
            ) {
              response.statusCode = 200;
              response.body = JSON.stringify({
                message: "This user already has instructor permissions.",
                alreadyInstructor: true,
              });
              break;
            }

            // User is a student - elevate to instructor
            // First, add to Cognito instructor group
            const cognitoClient = new CognitoIdentityProviderClient();

            try {
              let username = existingUser[0].cognito_id;

              if (!username) {
                throw new Error(
                  "User cognito_id is missing in the database. Cannot elevate user.",
                );
              }

              await cognitoClient.send(
                new AdminAddUserToGroupCommand({
                  UserPoolId: USER_POOL_ID,
                  Username: username,
                  GroupName: "instructor",
                }),
              );
            } catch (cognitoErr) {
              console.error(
                "Failed to add user to Cognito instructor group:",
                cognitoErr,
              );
              response.statusCode = 500;
              response.body = JSON.stringify({
                error: "Failed to update user permissions in Cognito.",
              });
              break;
            }

            // Update database roles
            const newRoles = userRoles.map((role) =>
              role === "student" ? "instructor" : role,
            );

            await sqlConnectionTableCreator`
              UPDATE "users"
              SET roles = ${newRoles}
              WHERE user_email = ${instructorEmail};
            `;

            response.statusCode = 200;
            response.body = JSON.stringify({
              message: "User successfully elevated to instructor.",
              success: true,
            });
          } catch (err) {
            response.statusCode = 500;
            console.error(err);
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({ error: "Email is required" });
        }
        break;
      case "POST /admin/lower_instructor":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.user_id
        ) {
          try {
            const user_id = event.queryStringParameters.user_id;

            // Fetch the roles for the user
            const userRoleData = await sqlConnectionTableCreator`
                    SELECT roles, user_id
                    FROM "users"
                    WHERE user_id = ${user_id};
                  `;

            const userRoles = userRoleData[0]?.roles;
            const userId = userRoleData[0]?.user_id;

            if (!userRoles || !userRoles.includes("instructor")) {
              response.statusCode = 400;
              response.body = JSON.stringify({
                error: "User is not an instructor or doesn't exist",
              });
              break;
            }

            // Replace 'instructor' with 'student'
            const updatedRoles = userRoles
              .filter((role) => role !== "instructor")
              .concat("student");

            // Update the roles in the database
            await sqlConnectionTableCreator`
                    UPDATE "users"
                    SET roles = ${updatedRoles}
                    WHERE user_id = ${user_id};
                  `;

            // Remove from instructor_students table
            await sqlConnectionTableCreator`
      DELETE FROM "instructor_students"
      WHERE instructor_id = ${user_id};
    `;

            response.statusCode = 200;
            response.body = JSON.stringify({
              message: `User role updated to student for ${user_id} and all instructor assigned deleted.`,
            });
          } catch (err) {
            console.log(err);
            response.statusCode = 500;
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "email query parameter is missing",
          });
        }
        break;

      case "DELETE /admin/delete_instructor_student_assignment":
        if (
          event.queryStringParameters != null &&
          event.queryStringParameters.instructor_id &&
          event.queryStringParameters.student_id
        ) {
          try {
            const instructor_id = event.queryStringParameters.instructor_id;
            const student_id = event.queryStringParameters.student_id;

            // Fetch the roles for the instructor
            const userRoleData = await sqlConnectionTableCreator`
                SELECT roles, user_id
                FROM "users"
                WHERE user_id = ${instructor_id};
              `;

            const userRoles = userRoleData[0]?.roles;
            const userId = userRoleData[0]?.user_id;

            if (!userRoles || !userRoles.includes("instructor")) {
              response.statusCode = 400;
              response.body = JSON.stringify({
                error: "User is not an instructor or doesn't exist",
              });
              break;
            }

            // Step 1: Check if the relationship between the instructor and student exists
            const assignmentCheck = await sqlConnectionTableCreator`
                SELECT * FROM "instructor_students"
                WHERE instructor_id = ${instructor_id} AND student_id = ${student_id};
              `;

            if (assignmentCheck.length === 0) {
              response.statusCode = 404;
              response.body = JSON.stringify({
                error: "Instructor-student assignment not found",
              });
              break;
            }

            // Step 2: Unassign the instructor from the student
            await sqlConnectionTableCreator`
                DELETE FROM "instructor_students"
                WHERE instructor_id = ${instructor_id} AND student_id = ${student_id};
              `;

            response.statusCode = 200;
            response.body = JSON.stringify({
              message: `Instructor ${instructor_id} successfully unassigned from student ${student_id}.`,
            });
          } catch (err) {
            console.log(err);
            response.statusCode = 500;
            response.body = JSON.stringify({ error: "Internal server error" });
          }
        } else {
          response.statusCode = 400;
          response.body = JSON.stringify({
            error: "Instructor ID and Student ID query parameters are required",
          });
        }
        break;

      default:
        throw new Error(`Unsupported route: "${pathData}"`);
    }
  } catch (error) {
    response.statusCode = 400;
    console.log(error);
    response.body = JSON.stringify(error.message);
  }
  console.log(response);
  return response;
};
