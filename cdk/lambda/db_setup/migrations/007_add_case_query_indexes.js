// Migration: Add indexes for common case listing and dashboard queries

exports.up = (pgm) => {
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_cases_student_id ON cases(student_id);
    CREATE INDEX IF NOT EXISTS idx_cases_student_last_updated
      ON cases(student_id, last_updated DESC);
    CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_cases_status;
    DROP INDEX IF EXISTS idx_cases_student_last_updated;
    DROP INDEX IF EXISTS idx_cases_student_id;
  `);
};
