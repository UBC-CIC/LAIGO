// Database connection utility
const { initializeConnection } = require("./lib.js");
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
 * Assigns new users to appropriate Cognito groups based on their roles in the database
 * Defaults to 'student' group if no database role exists
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
    // Retrieve user attributes from Cognito to get email address
    const getUserCommand = new AdminGetUserCommand({
      UserPoolId: userPoolId,
      Username: userName,
    });
    const userAttributesResponse = await client.send(getUserCommand);

    // Find email attribute in user attributes array
    const emailAttr = userAttributesResponse.UserAttributes.find(
      (attr) => attr.Name === "email"
    );

    // Return error if email attribute is missing
    if (!emailAttr) {
      console.error("Email attribute missing from Cognito");
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Email attribute not found in Cognito user",
        }),
      };
    }

    const email = emailAttr.Value;

    // Query database for user's assigned roles
    const dbUser = await sqlConnection`
      SELECT roles FROM "users" WHERE user_email = ${email};
    `;

    // Extract roles array or default to empty array
    const dbRoles = dbUser[0]?.roles || [];

    // Determine Cognito group: use first database role or default to 'student'
    const newGroupName = dbRoles.length > 0 ? dbRoles[0] : "student";

    // Add user to the determined Cognito group
    const addUserToGroupCommand = new AdminAddUserToGroupCommand({
      UserPoolId: userPoolId,
      Username: userName,
      GroupName: newGroupName,
    });
    await client.send(addUserToGroupCommand);

    // Return event to continue post-confirmation flow
    return event;
  } catch (err) {
    console.error("Error assigning user to group:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal Server Error",
      }),
    };
  }
};
