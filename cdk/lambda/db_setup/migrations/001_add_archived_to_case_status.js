exports.up = (pgm) => {
  // Add 'archived' enum value to case_status if it doesn't exist
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'case_status' AND e.enumlabel = 'archived'
      ) THEN
        ALTER TYPE case_status ADD VALUE 'archived';
      END IF;
    END $$;
  `);
};

exports.down = (pgm) => {
  // Removing enum values is not safe in-place; keep down migration as no-op
};
