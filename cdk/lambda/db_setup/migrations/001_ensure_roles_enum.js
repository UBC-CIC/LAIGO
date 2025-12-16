exports.up = (pgm) => {
  pgm.sql(`
    -- Function to coerce/validate roles array items to user_role enum for users table
    CREATE OR REPLACE FUNCTION ensure_roles_enum() RETURNS trigger AS $$
    BEGIN
      IF NEW.roles IS NOT NULL THEN
        -- Cast each element to user_role; this will raise if an invalid value is present
        NEW.roles := ARRAY(SELECT (r::user_role) FROM unnest(NEW.roles) AS r);
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Trigger to call the function before insert or update on users
    CREATE TRIGGER trg_ensure_roles_enum BEFORE INSERT OR UPDATE ON "users"
      FOR EACH ROW EXECUTE FUNCTION ensure_roles_enum();

    -- Function to ensure enums on cases table
    CREATE OR REPLACE FUNCTION ensure_cases_enums() RETURNS trigger AS $$
    BEGIN
      IF NEW.status IS NOT NULL THEN
        NEW.status := NEW.status::case_status;
      END IF;

      IF NEW.unlocked_blocks IS NOT NULL THEN
        NEW.unlocked_blocks := ARRAY(SELECT (r::block_type) FROM unnest(NEW.unlocked_blocks) AS r);
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_ensure_cases_enums BEFORE INSERT OR UPDATE ON "cases"
      FOR EACH ROW EXECUTE FUNCTION ensure_cases_enums();

    -- Function to ensure enums on prompt_versions table
    CREATE OR REPLACE FUNCTION ensure_prompt_versions_enums() RETURNS trigger AS $$
    BEGIN
      IF NEW.category IS NOT NULL THEN
        NEW.category := NEW.category::prompt_category;
      END IF;

      IF NEW.block_type IS NOT NULL THEN
        NEW.block_type := NEW.block_type::block_type;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_ensure_prompt_versions_enums BEFORE INSERT OR UPDATE ON "prompt_versions"
      FOR EACH ROW EXECUTE FUNCTION ensure_prompt_versions_enums();

    -- Function to ensure enums on summaries table
    CREATE OR REPLACE FUNCTION ensure_summaries_enums() RETURNS trigger AS $$
    BEGIN
      IF NEW.scope IS NOT NULL THEN
        NEW.scope := NEW.scope::summary_scope;
      END IF;

      IF NEW.block_context IS NOT NULL THEN
        NEW.block_context := NEW.block_context::block_type;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_ensure_summaries_enums BEFORE INSERT OR UPDATE ON "summaries"
      FOR EACH ROW EXECUTE FUNCTION ensure_summaries_enums();

    -- Attempt to coerce existing rows to the enum types (will fail if invalid values exist)
    UPDATE "users" SET roles = ARRAY(SELECT (r::user_role) FROM unnest(roles) AS r) WHERE roles IS NOT NULL;

    UPDATE "cases" SET status = status::case_status WHERE status IS NOT NULL;
    UPDATE "cases" SET unlocked_blocks = ARRAY(SELECT (r::block_type) FROM unnest(unlocked_blocks) AS r) WHERE unlocked_blocks IS NOT NULL;

    UPDATE "prompt_versions" SET category = category::prompt_category WHERE category IS NOT NULL;
    UPDATE "prompt_versions" SET block_type = block_type::block_type WHERE block_type IS NOT NULL;

    UPDATE "summaries" SET scope = scope::summary_scope WHERE scope IS NOT NULL;
    UPDATE "summaries" SET block_context = block_context::block_type WHERE block_context IS NOT NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TRIGGER IF EXISTS trg_ensure_roles_enum ON "users";
    DROP FUNCTION IF EXISTS ensure_roles_enum();

    DROP TRIGGER IF EXISTS trg_ensure_cases_enums ON "cases";
    DROP FUNCTION IF EXISTS ensure_cases_enums();

    DROP TRIGGER IF EXISTS trg_ensure_prompt_versions_enums ON "prompt_versions";
    DROP FUNCTION IF EXISTS ensure_prompt_versions_enums();

    DROP TRIGGER IF EXISTS trg_ensure_summaries_enums ON "summaries";
    DROP FUNCTION IF EXISTS ensure_summaries_enums();
  `);
};
