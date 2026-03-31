// Migration: Seed a default disclaimer so new deployments have one active record.
// Admins can later edit or replace via the UI.

exports.up = async function (pgm) {
  pgm.sql(`
    INSERT INTO disclaimers (author_id, disclaimer_text, version_number, version_name, is_active)
    VALUES
      (NULL,
       'This system uses artificial intelligence (AI) to generate content, including explanations, suggestions, and responses to user prompts.

AI-generated content is provided for informational and educational purposes only and may contain errors, omissions, bias, or outdated information.

The system does not guarantee the accuracy, completeness, reliability, or suitability of any output for your specific needs or context.

You must independently verify all AI-generated information against trusted, authoritative sources before relying on it.
Do not rely on AI output as the sole basis for decisions involving health, safety, legal rights, financial matters, academic integrity, or other high-stakes outcomes.

You remain fully responsible for all decisions, actions, submissions, and consequences resulting from your use of this system and its outputs.

AI responses may sound confident even when incorrect; confidence in wording should not be interpreted as correctness.

The system may misinterpret your prompt or missing context, which can lead to irrelevant or misleading results.

Where appropriate, consult qualified professionals (for example, instructors, licensed practitioners, legal counsel, or financial advisors) before acting on AI-generated information.

By using this system, you acknowledge these limitations and agree to use AI outputs as a starting point for critical review, not as a substitute for independent judgment.',
       1,
       'Default Disclaimer',
       true)
    ON CONFLICT DO NOTHING;
  `);
};

exports.down = async function (pgm) {
  pgm.sql(`
    -- Remove system-seeded v1 disclaimers (author_id IS NULL, version_number = 1)
    DELETE FROM disclaimers
    WHERE author_id IS NULL
      AND version_number = 1
      AND version_name LIKE 'Default %';
  `);
};