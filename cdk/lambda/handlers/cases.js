const postgres = require("postgres");
const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");

let sqlConnection;
const secretsManager = new SecretsManagerClient();

const initConnection = async () => {
  if (!sqlConnection) {
    try {
      const getSecretValueCommand = new GetSecretValueCommand({
        SecretId: process.env.SM_DB_CREDENTIALS,
      });
      const secretResponse = await secretsManager.send(getSecretValueCommand);
      const credentials = JSON.parse(secretResponse.SecretString);

      const connectionConfig = {
        host: process.env.RDS_PROXY_ENDPOINT,
        port: credentials.port,
        username: credentials.username,
        password: credentials.password,
        database: credentials.dbname,
        ssl: { rejectUnauthorized: false },
      };

      sqlConnection = postgres(connectionConfig);
      await sqlConnection`SELECT 1`;
      console.log("Database connection initialized successfully");
    } catch (error) {
      console.error("Error initializing database connection:", error);
      throw error;
    }
  }
};

const createResponse = () => ({
  statusCode: 200,
  headers: {
    "Access-Control-Allow-Headers":
      "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  },
  body: "",
});

const parseBody = (body) => {
  try {
    return JSON.parse(body || "{}");
  } catch {
    throw new Error("Invalid JSON body");
  }
};

const handleError = (error, response) => {
  response.statusCode = 500;
  console.error(error);
  response.body = JSON.stringify({ error: error.message || String(error) });
};

exports.handler = async (event) => {
  const response = createResponse();
  let data;

  try {
    await initConnection();
    const pathData = event.httpMethod + " " + event.resource;

    switch (pathData) {
      case "GET /cases": {
        // List cases for a given cognito user id (query param: user_id or cognito_id)
        const limit = Math.min(parseInt(event.queryStringParameters?.limit) || 20, 200);
        const offset = parseInt(event.queryStringParameters?.offset) || 0;
        // Derive Cognito id from the API Gateway authorizer (preferred) or principalId
        const authorizer = event.requestContext?.authorizer || {};
        const cognitoId = authorizer?.claims?.sub || authorizer?.principalId;
        console.log("authorizer info:", authorizer);

        if (!cognitoId) {
          response.statusCode = 401;
          response.body = JSON.stringify({ error: "Unauthorized: missing authenticated user id" });
          break;
        }

        // find internal user_id
        const dbUser = await sqlConnection`
          SELECT user_id FROM users WHERE cognito_id = ${cognitoId} LIMIT 1;
        `;

        const userId = dbUser?.[0]?.user_id;
        if (!userId) {
          // no user -> empty list
          response.body = JSON.stringify({ cases: [], pagination: { limit, offset, total: 0, hasMore: false } });
          break;
        }

        const result = await sqlConnection`
          SELECT case_id, case_hash, case_title, case_type, status, jurisdiction, last_updated,
                 COUNT(*) OVER() AS total_count
          FROM cases
          WHERE student_id = ${userId}
          ORDER BY last_updated DESC
          LIMIT ${limit} OFFSET ${offset}
        `;

        const total = result.length > 0 ? parseInt(result[0].total_count) : 0;
        const cases = result.map(({ total_count, ...rest }) => rest);

        data = {
          cases,
          pagination: {
            limit,
            offset,
            total,
            hasMore: offset + limit < total,
          },
        };

        response.body = JSON.stringify(data);
        break;
      }

      default:
        throw new Error(`Unsupported route: "${pathData}"`);
    }
  } catch (error) {
    handleError(error, response);
  }

  console.log(response);
  return response;
};