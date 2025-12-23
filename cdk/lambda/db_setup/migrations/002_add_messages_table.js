exports.up = (pgm) => {
  pgm.sql(`
    -- Create messages table for instructor <-> student feedback
    CREATE TABLE IF NOT EXISTS "messages" (
      "message_id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "instructor_id" uuid,
      "message_content" text,
      "case_id" uuid,
      "time_sent" timestamptz DEFAULT now(),
      "is_read" boolean DEFAULT false
    );

    ALTER TABLE "messages" ADD CONSTRAINT fk_messages_case FOREIGN KEY ("case_id") REFERENCES "cases" ("case_id") ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "messages" ADD CONSTRAINT fk_messages_instructor FOREIGN KEY ("instructor_id") REFERENCES "users" ("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

    -- Helpful indexes
    CREATE INDEX IF NOT EXISTS idx_messages_case_id ON "messages" ("case_id");
    CREATE INDEX IF NOT EXISTS idx_messages_instructor_id ON "messages" ("instructor_id");
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_messages_case_id;
    DROP INDEX IF EXISTS idx_messages_instructor_id;
    ALTER TABLE IF EXISTS "messages" DROP CONSTRAINT IF EXISTS fk_messages_case;
    ALTER TABLE IF EXISTS "messages" DROP CONSTRAINT IF EXISTS fk_messages_instructor;
    DROP TABLE IF EXISTS "messages";
  `);
};
