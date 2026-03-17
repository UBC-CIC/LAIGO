// Migration: add 'summary' to prompt_category enum and introduce a prompt_scope
// column to distinguish block-level prompts from full-case synthesis prompts.
// This avoids polluting the block_type enum with a non-block value.

exports.up = async function (pgm) {
  pgm.sql(`
    -- 1. Add 'summary' to prompt_category enum
    DO $$ BEGIN
      ALTER TYPE prompt_category ADD VALUE 'summary';
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- 2. Add prompt_scope column (defaults to 'block' so all existing rows are unaffected)
    ALTER TABLE prompt_versions
      ADD COLUMN IF NOT EXISTS prompt_scope text
      NOT NULL
      DEFAULT 'block'
      CHECK (prompt_scope IN ('block', 'full_case'));

    -- 3. Make block_type nullable to support full-case rows that have no block_type
    ALTER TABLE prompt_versions
      ALTER COLUMN block_type DROP NOT NULL;

    -- 4. Drop the old unique active-prompt index
    DROP INDEX IF EXISTS ux_prompt_versions_one_active;

    -- 5a. One active prompt per (category, block_type) for block-scope prompts
    CREATE UNIQUE INDEX IF NOT EXISTS ux_prompt_versions_one_active_block
      ON prompt_versions (category, block_type)
      WHERE is_active = true AND prompt_scope = 'block';

    -- 5b. One active prompt per category for full-case prompts
    CREATE UNIQUE INDEX IF NOT EXISTS ux_prompt_versions_one_active_full_case
      ON prompt_versions (category)
      WHERE is_active = true AND prompt_scope = 'full_case';
  `);
};

exports.down = async function (pgm) {
  pgm.sql(`
    DROP INDEX IF EXISTS ux_prompt_versions_one_active_block;
    DROP INDEX IF EXISTS ux_prompt_versions_one_active_full_case;

    -- Drop the prompt_scope column
    ALTER TABLE prompt_versions DROP COLUMN IF EXISTS prompt_scope;

    -- Restore block_type NOT NULL constraint (only safe if no full-case rows exist)
    -- ALTER TABLE prompt_versions ALTER COLUMN block_type SET NOT NULL;

    -- Recreate original index
    CREATE UNIQUE INDEX IF NOT EXISTS ux_prompt_versions_one_active
      ON prompt_versions (category, block_type)
      WHERE is_active = true;
  `);
};
