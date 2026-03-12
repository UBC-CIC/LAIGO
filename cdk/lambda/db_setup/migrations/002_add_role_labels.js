/**
 * Migration: Add role_labels table for configurable role display names.
 *
 * Canonical role keys (student / instructor / admin) are immutable enum values
 * in the user_role type.  This table stores the display labels (singular and
 * plural) that admins can customise through the UI.
 */

exports.up = async function (pgm) {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS role_labels (
      role_key       user_role   PRIMARY KEY,
      singular_label varchar(64) NOT NULL,
      plural_label   varchar(64) NOT NULL,
      updated_by     uuid        REFERENCES users(user_id) ON DELETE SET NULL,
      updated_at     timestamptz NOT NULL DEFAULT now()
    );

    -- Seed default labels; skip if rows already exist (idempotent re-runs).
    INSERT INTO role_labels (role_key, singular_label, plural_label)
    VALUES
      ('student',    'Advocate',   'Advocates'),
      ('instructor', 'Supervisor', 'Supervisors'),
      ('admin',      'Admin',      'Admins')
    ON CONFLICT (role_key) DO NOTHING;
  `);
};

exports.down = async function (pgm) {
  pgm.sql(`DROP TABLE IF EXISTS role_labels;`);
};
