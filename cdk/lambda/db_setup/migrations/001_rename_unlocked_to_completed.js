// Migration: rename unlocked_blocks column to completed_blocks
// Add after initial schema (version 000_initial_schema.js)

exports.up = async function (pgm) {
  // rename column and keep existing data
  pgm.sql(`
    ALTER TABLE "cases" RENAME COLUMN unlocked_blocks TO completed_blocks;
  `);
};

exports.down = async function (pgm) {
  // revert name if migrating down
  pgm.sql(`
    ALTER TABLE "cases" RENAME COLUMN completed_blocks TO unlocked_blocks;
  `);
};
