exports.handler = async (event) => {
  // Connection valid (authorized by Lambda Authorizer)
  return { statusCode: 200, body: "Connected" };
};
