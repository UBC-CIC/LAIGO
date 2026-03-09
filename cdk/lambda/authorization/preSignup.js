const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");
const { Logger } = require("@aws-lambda-powertools/logger");
const logger = new Logger({ serviceName: "PreSignup" });

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
    if (!parameterName) {
      throw new Error("Environment variable ALLOWED_EMAIL_DOMAINS is not set");
    }

    // Retrieve allowed email domains from SSM Parameter Store
    const getParameterCommand = new GetParameterCommand({
      Name: parameterName,
      WithDecryption: true, // Decrypt if parameter is encrypted
    });
    const data = await ssmClient.send(getParameterCommand);

    if (!data || !data.Parameter || !data.Parameter.Value) {
      throw new Error(
        `SSM parameter ${parameterName} not found or has no value`,
      );
    }

    // Parse comma-separated list of allowed domains (trim and lowercase for robust comparison)
    const allowedDomains = data.Parameter.Value.split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    logger.info("Allowed domains retrieved", { allowedDomains });

    if (allowedDomains.length === 0) {
      throw new Error(
        `SSM parameter ${parameterName} contains no allowed domains`,
      );
    }

    // Extract email and domain from user attributes
    const email = event?.request?.userAttributes?.email;

    if (!email) {
      logger.error("No email attribute provided; rejecting signup");
      throw new Error("Email attribute is required for signup");
    }

    const parts = email.split("@");
    if (parts.length < 2) {
      throw new Error(`Invalid email address provided: ${email}`);
    }
    const emailDomain = parts.slice(1).join("@").trim().toLowerCase();
    logger.info("Signup request details", { email, emailDomain });

    // Accept only exact domain matches (no subdomain matching)
    const isAllowed = allowedDomains.some((allowed) => {
      if (allowed === "*") return true; // wildcard allows all
      return allowed === emailDomain; // exact match only
    });

    // Reject signup if email domain is not allowed
    if (!isAllowed) {
      logger.error("Domain not allowed", { emailDomain, allowedDomains });
      throw new Error(`Signup not allowed for email domain: ${emailDomain}`);
    }

    // All good — continue signup
    return event;
  } catch (error) {
    logger.error("PreSignUp error", error);
    // Rethrow the original error so CloudWatch/Cognito get the specific message
    throw error;
  }
};
