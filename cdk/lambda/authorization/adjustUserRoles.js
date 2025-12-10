// Database connection utility
const { initializeConnection } = require("./lib.js");
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
      (group) => group.GroupName
    );

    // Get user attributes to extract email address
    const userAttributesCommand = new AdminGetUserCommand({
      UserPoolId: userPoolId,
      Username: userName,
    });
    const userAttributesResponse = await client.send(userAttributesCommand);

    // Extract email from user attributes
    const emailAttr = userAttributesResponse.UserAttributes.find(
      (attr) => attr.Name === "email"
    );
    const email = emailAttr ? emailAttr.Value : null;

    // Query database for user's current roles
    const dbUser = await sqlConnection`
      SELECT roles FROM "users"
      WHERE user_email = ${email};
    `;

    // Extract roles array or default to empty array
    const dbRoles = dbUser[0]?.roles || [];

    // Synchronize roles between Cognito groups and database
    // Priority: Admin roles take precedence, then sync non-admin roles
    if (cognitoRoles.includes("admin")) {
      // Case 1: User has admin role in Cognito - ensure database also has admin
      if (!dbRoles.includes("admin")) {
        await sqlConnection`
          UPDATE "users"
          SET roles = array_append(roles, 'admin')
          WHERE user_email = ${email};
        `;
        console.log("DB roles updated to include admin");
      }
    } else if (
      cognitoRoles.some((role) => ["instructor", "student"].includes(role))
    ) {
      // Case 2: User has non-admin role in Cognito
      const cognitoNonAdminRole = cognitoRoles.find((role) =>
        ["instructor", "student"].includes(role)
      );

      if (dbRoles.includes("admin")) {
        // If database has admin but Cognito doesn't, demote database role to match Cognito
        await sqlConnection`
          UPDATE "users"
          SET roles = ${[cognitoNonAdminRole]}
          WHERE user_email = ${email};
        `;
      } else if (dbRoles.length && dbRoles[0] !== cognitoNonAdminRole) {
        // If roles don't match and neither is admin, update Cognito to match database
        const removeFromGroupCommand = new AdminRemoveUserFromGroupCommand({
          UserPoolId: userPoolId,
          Username: userName,
          GroupName: cognitoNonAdminRole,
        });
        const addToGroupCommand = new AdminAddUserToGroupCommand({
          UserPoolId: userPoolId,
          Username: userName,
          GroupName: dbRoles[0],
        });

        // Remove user from current group and add to correct group
        await client.send(removeFromGroupCommand);
        await client.send(addToGroupCommand);
      }
    }

    // Return event to continue the flow
    return event;
  } catch (err) {
    // Log error but don't fail the authentication flow
    console.error("Error synchronizing user roles:", err);
    return event;
  }
};
