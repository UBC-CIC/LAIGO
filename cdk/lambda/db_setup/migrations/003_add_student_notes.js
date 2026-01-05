exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE cases ADD COLUMN student_notes TEXT;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE cases DROP COLUMN student_notes;
  `);
};
