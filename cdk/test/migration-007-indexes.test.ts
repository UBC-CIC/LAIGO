/**
 * Unit Tests: Migration 007 - Case query indexes
 */

const migration = require("../lambda/db_setup/migrations/007_add_case_query_indexes");

describe("Migration 007: Add case query indexes", () => {
  let pgm: { sql: jest.Mock; capturedSql: string[] };

  beforeEach(() => {
    pgm = {
      capturedSql: [],
      sql: jest.fn((sqlStr: string) => {
        pgm.capturedSql.push(sqlStr);
      }),
    };
  });

  describe("up migration", () => {
    beforeEach(() => {
      migration.up(pgm);
    });

    it("creates student_id and composite indexes", () => {
      const sql = pgm.capturedSql[0];
      expect(sql).toMatch(/idx_cases_student_id/i);
      expect(sql).toMatch(/idx_cases_student_last_updated/i);
      expect(sql).toMatch(/idx_cases_status/i);
    });
  });

  describe("down migration", () => {
    beforeEach(() => {
      migration.down(pgm);
    });

    it("drops all indexes", () => {
      const sql = pgm.capturedSql[0];
      expect(sql).toMatch(/DROP INDEX IF EXISTS idx_cases_status/i);
      expect(sql).toMatch(/DROP INDEX IF EXISTS idx_cases_student_last_updated/i);
      expect(sql).toMatch(/DROP INDEX IF EXISTS idx_cases_student_id/i);
    });
  });
});
