// Database connection utility
const { initializeConnection } = require("./initializeConnection.js");
// AWS SDK imports for Cognito Identity Provider
const {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
} = require("@aws-sdk/client-cognito-identity-provider");

// Environment variables for database connection
const { SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT } = process.env;
let sqlConnection = global.sqlConnection;

/**
 * Cognito Post-Confirmation Lambda Trigger
 * Creates or updates user records in RDS database after email verification
 * Database is the single source of truth for user roles and metadata
 * Does NOT manage Cognito groups - authorization is database-driven
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
    const idpId = attributes.find(attr => attr.Name === "sub")?.Value; // IDP User ID (UUID)

    // Return error if email attribute is missing
    if (!email) {
      console.error("Email attribute missing from Cognito");
      throw new Error("Email attribute not found in Cognito user");
    }

    // Check if user already exists in database
    const existingUser = await sqlConnection`
      SELECT * FROM "users" WHERE idp_id = ${idpId} OR user_email = ${email};
    `;

    if (existingUser.length > 0) {
      // Update existing user's information
      console.log("Updating existing user in database");
      await sqlConnection`
        UPDATE "users"
        SET
          first_name = ${firstName},
          last_name = ${lastName},
          last_sign_in = CURRENT_TIMESTAMP,
          idp_id = ${idpId}
        WHERE user_email = ${email}
        RETURNING *;
      `;
      
      console.log(`User ${email} updated in database`);
      
    } else {
      // Check if this is the first user in the system
      const userCount = await sqlConnection`
        SELECT COUNT(*) as count FROM "users";
      `;
      
      const isFirstUser = parseInt(userCount[0].count, 10) === 0;
      const defaultRole = isFirstUser ? 'admin' : 'student';
      
      console.log(`Creating new user in database with role: ${defaultRole} (first user: ${isFirstUser})`);
      
      // Create new user with admin role if first user, otherwise student
      const newUser = await sqlConnection`
        INSERT INTO "users" (idp_id, user_email, first_name, last_name, time_account_created, roles, last_sign_in)
        VALUES (${idpId}, ${email}, ${firstName}, ${lastName}, CURRENT_TIMESTAMP, ARRAY[${defaultRole}]::user_role[], CURRENT_TIMESTAMP)
        RETURNING *;
      `;
      
      console.log("New user created:", newUser[0]);
    }

    // Return event to continue post-confirmation flow
    return event;
  } catch (err) {
    console.error("Error in post-confirmation trigger:", err);
    // Don't throw error - this would block user confirmation
    // Database errors are logged but don't prevent authentication (graceful degradation)
    return event;
  }
};
