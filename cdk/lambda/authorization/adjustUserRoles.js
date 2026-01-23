// Database connection utility
const { initializeConnection } = require("./initializeConnection");
// AWS SDK imports for Cognito Identity Provider operations
const {
  CognitoIdentityProviderClient,
  AdminListGroupsForUserCommand,
  AdminGetUserCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
} = require("@aws-sdk/client-cognito-identity-provider");

// Environment variables for database connection
const { SM_DB_CREDENTIALS, RDS_PROXY_ENDPOINT } = process.env;
let sqlConnection = global.sqlConnection;

/**
 * Lambda function to synchronize user roles between Cognito groups and database
 * Handles role conflicts by prioritizing admin roles and maintaining consistency
 * between Cognito Identity Provider groups and database user roles
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
    // Retrieve current Cognito groups for the user
    const userGroupsCommand = new AdminListGroupsForUserCommand({
      UserPoolId: userPoolId,
      Username: userName,
    });
    const userGroupsResponse = await client.send(userGroupsCommand);
    const cognitoRoles = userGroupsResponse.Groups.map(
      (group) => group.GroupName,
    );

    // Get user attributes to extract email address
    const userAttributesCommand = new AdminGetUserCommand({
      UserPoolId: userPoolId,
      Username: userName,
    });
    const userAttributesResponse = await client.send(userAttributesCommand);

    // Extract email from user attributes
    const emailAttr = userAttributesResponse.UserAttributes.find(
      (attr) => attr.Name === "email",
    );
    const email = emailAttr ? emailAttr.Value : null;

    // Query database for user's current roles
    const dbUser = await sqlConnection`
      SELECT roles FROM "users"
      WHERE user_email = ${email};
    `;

    // Extract roles array or default to empty array
    const dbRoles = dbUser[0]?.roles || [];

    // COGNITO IS THE SOURCE OF TRUTH FOR ALL ROLES
    // Determine the primary role from Cognito (priority: admin > instructor > student)
    let cognitoPrimaryRole = null;
    if (cognitoRoles.includes("admin")) {
      cognitoPrimaryRole = "admin";
    } else if (cognitoRoles.includes("instructor")) {
      cognitoPrimaryRole = "instructor";
    } else if (cognitoRoles.includes("student")) {
      cognitoPrimaryRole = "student";
    }

    // If user has a Cognito role, sync it to the database
    if (cognitoPrimaryRole) {
      const dbPrimaryRole = dbRoles.length > 0 ? dbRoles[0] : null;

      // Only update database if roles don't match
      if (dbPrimaryRole !== cognitoPrimaryRole) {
        await sqlConnection`
          UPDATE "users"
          SET roles = ARRAY[${cognitoPrimaryRole}]::user_role[]
          WHERE user_email = ${email};
        `;
        console.log(
          `Database role updated from '${dbPrimaryRole}' to '${cognitoPrimaryRole}' to match Cognito`,
        );
      } else {
        console.log(`Roles already in sync: ${cognitoPrimaryRole}`);
      }
    } else {
      // User has no recognized Cognito role - log warning but don't fail
      console.warn(
        `User ${email} has no recognized Cognito role (admin/instructor/student)`,
      );
    }

    // Return event to continue the flow
    return event;
  } catch (err) {
    // Log error but don't fail the authentication flow
    console.error("Error synchronizing user roles:", err);
    return event;
  }
};
