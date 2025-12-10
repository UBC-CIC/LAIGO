// AWS SDK imports for Systems Manager Parameter Store
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

/**
 * Cognito Pre-Signup Lambda Trigger
 * Validates user email domain against allowed domains list stored in SSM Parameter Store
 * Prevents signup for unauthorized email domains
 */
exports.handler = async (event) => {
  // Initialize SSM client for parameter retrieval
  const ssmClient = new SSMClient();
  const parameterName = process.env.ALLOWED_EMAIL_DOMAINS;

  try {
    // Retrieve allowed email domains from SSM Parameter Store
    const getParameterCommand = new GetParameterCommand({
      Name: parameterName,
      WithDecryption: true, // Decrypt if parameter is encrypted
    });
    const data = await ssmClient.send(getParameterCommand);
    
    // Parse comma-separated list of allowed domains
    const allowedDomains = data.Parameter.Value.split(",");
    
    // Extract email and domain from user attributes
    const email = event.request.userAttributes.email;
    const emailDomain = email.split("@")[1];

    // Reject signup if email domain is not in allowed list
    if (!allowedDomains.includes(emailDomain)) {
      throw new Error(`Signup not allowed for email domain: ${emailDomain}`);
    }

    // Return event to continue signup process
    return event;
  } catch (error) {
    console.error(error);
    throw new Error("Error validating email domain during pre-signup.");
  }
};
