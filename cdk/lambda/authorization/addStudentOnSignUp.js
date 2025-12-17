// Database connection utility
const { initializeConnection } = require("./initializeConnection.js");
// AWS SDK imports for Cognito Identity Provider
const {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
  AdminAddUserToGroupCommand,
} = require("@aws-sdk/client-cognito-identity-provider");

// Environment variables for database connection
const { SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT } = process.env;
let sqlConnection = global.sqlConnection;

/**
 * Cognito Post-Confirmation Lambda Trigger
 * Creates or updates user records in RDS database after email verification
 * Assigns users to appropriate Cognito groups based on database roles
 */
exports.handler = async (event) => {
  // Initialize database connection if not already established
  if (!sqlConnection) {
    await initializeConnection(SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT);
    sqlConnection = global.sqlConnection;
  }

  const { userName, userPoolId } = event;
  const client = new CognitoIdentityProviderClient();

  try {
    // Retrieve user attributes from Cognito
    const getUserCommand = new AdminGetUserCommand({
      UserPoolId: userPoolId,
      Username: userName,
    });
    const userAttributesResponse = await client.send(getUserCommand);

    // Extract user attributes
    const attributes = userAttributesResponse.UserAttributes;
    const email = attributes.find(attr => attr.Name === "email")?.Value;
    const firstName = attributes.find(attr => attr.Name === "given_name")?.Value || "";
    const lastName = attributes.find(attr => attr.Name === "family_name")?.Value || "";
    const cognitoUserId = attributes.find(attr => attr.Name === "sub")?.Value; // Real Cognito User ID (UUID)

    // Return error if email attribute is missing
    if (!email) {
      console.error("Email attribute missing from Cognito");
      throw new Error("Email attribute not found in Cognito user");
    }

    // Check if user already exists in database
    const existingUser = await sqlConnection`
      SELECT * FROM "users" WHERE cognito_id = ${cognitoUserId} OR user_email = ${email};
    `;

    let newGroupName = "student"; // Default group

    if (existingUser.length > 0) {
      // Update existing user's information
      console.log("Updating existing user in database");
      const updatedUser = await sqlConnection`
        UPDATE "users"
        SET
          first_name = ${firstName},
          last_name = ${lastName},
          last_sign_in = CURRENT_TIMESTAMP,
          cognito_id = ${cognitoUserId}
        WHERE user_email = ${email}
        RETURNING *;
      `;
      
      // Use existing user's role for Cognito group
      const dbRoles = updatedUser[0]?.roles || [];
      newGroupName = dbRoles.length > 0 ? dbRoles[0] : "student";
      
    } else {
      // Create new user with 'student' role
      console.log("Creating new user in database");
      const newUser = await sqlConnection`
        INSERT INTO "users" (cognito_id, user_email, first_name, last_name, time_account_created, roles, last_sign_in)
        VALUES (${cognitoUserId}, ${email}, ${firstName}, ${lastName}, CURRENT_TIMESTAMP, ARRAY['student']::user_role[], CURRENT_TIMESTAMP)
        RETURNING *;
      `;
      
      console.log("New user created:", newUser[0]);
      newGroupName = "student"; // New users default to student
    }

    // Add user to the determined Cognito group
    const addUserToGroupCommand = new AdminAddUserToGroupCommand({
      UserPoolId: userPoolId,
      Username: userName,
      GroupName: newGroupName,
    });
    await client.send(addUserToGroupCommand);

    console.log(`User ${email} added to Cognito group: ${newGroupName}`);

    // Return event to continue post-confirmation flow
    return event;
  } catch (err) {
    console.error("Error in post-confirmation trigger:", err);
    // Don't return error response - this would block user confirmation
    // Instead, log error and continue with default behavior
    return event;
  }
};
