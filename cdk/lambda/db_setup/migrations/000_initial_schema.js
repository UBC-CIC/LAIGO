exports.up = (pgm) => {
  pgm.sql(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- Create enums
    CREATE TYPE user_role AS ENUM ('student', 'instructor', 'admin');
    CREATE TYPE case_status AS ENUM ('in_progress', 'submitted', 'reviewed', 'archived');
    CREATE TYPE block_type AS ENUM ('intake', 'legal_analysis', 'contrarian', 'policy');
    CREATE TYPE prompt_category AS ENUM ('reasoning', 'assessment');
    CREATE TYPE summary_scope AS ENUM ('block', 'full_case');

    -- Create tables
    CREATE TABLE users (
      user_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      cognito_id varchar,
      user_email varchar UNIQUE NOT NULL,
      username varchar,
      first_name varchar,
      last_name varchar,
      roles user_role[],
      time_account_created timestamptz DEFAULT now(),
      last_sign_in timestamptz DEFAULT now(),
      activity_counter integer DEFAULT 0,
      last_activity timestamptz DEFAULT now(),
      accepted_disclaimer boolean DEFAULT false
    );

    CREATE TABLE cases (
      case_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      student_id uuid,
      case_hash varchar UNIQUE,
      case_title varchar,
      case_type varchar,
      case_description text,
      jurisdiction varchar[],
      province varchar DEFAULT 'N/A',
      statute varchar DEFAULT 'N/A',
      status case_status DEFAULT 'in_progress',
      unlocked_blocks block_type[],
      last_updated timestamptz DEFAULT now(),
      last_viewed timestamptz DEFAULT now(),
      time_submitted timestamptz,
      time_reviewed timestamptz,
      sent_to_review boolean DEFAULT false,
      student_notes text
    );

    CREATE TABLE case_feedback (
      feedback_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      case_id uuid,
      author_id uuid,
      feedback_text text,
      time_created timestamptz DEFAULT now()
    );

    CREATE TABLE prompt_versions (
      prompt_version_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      category prompt_category NOT NULL,
      block_type block_type NOT NULL,
      version_number integer NOT NULL,
      version_name varchar,
      prompt_text text NOT NULL,
      author_id uuid,
      time_created timestamptz DEFAULT now(),
      is_active boolean DEFAULT false
    );

    CREATE TABLE summaries (
      summary_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      case_id uuid,
      scope summary_scope NOT NULL,
      block_context block_type,
      title varchar,
      content text,
      version integer DEFAULT 1,
      time_created timestamptz DEFAULT now()
    );

    CREATE TABLE annotations (
      annotation_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      summary_id uuid,
      author_id uuid,
      start_offset integer NOT NULL,
      end_offset integer NOT NULL,
      quote_text text,
      comment_text text,
      time_created timestamptz DEFAULT now()
    );

    CREATE TABLE audio_files (
      audio_file_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      case_id uuid,
      file_title varchar,
      audio_text text,
      s3_file_path text,
      time_uploaded timestamptz DEFAULT now()
    );

    CREATE TABLE messages (
      message_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      instructor_id uuid,
      message_content text,
      case_id uuid,
      time_sent timestamptz DEFAULT now(),
      is_read boolean DEFAULT false
    );

    CREATE TABLE case_reviewers (
      case_id uuid NOT NULL,
      reviewer_id uuid NOT NULL,
      assigned_at timestamptz DEFAULT now(),
      PRIMARY KEY (case_id, reviewer_id)
    );

    CREATE TABLE instructor_students (
      instructor_id uuid NOT NULL,
      student_id uuid NOT NULL,
      primary_assigned boolean DEFAULT true,
      PRIMARY KEY (instructor_id, student_id)
    );

    CREATE TABLE disclaimers (
      disclaimer_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      author_id uuid,
      disclaimer_text text NOT NULL,
      version_number integer NOT NULL,
      version_name varchar,
      time_created timestamptz DEFAULT now(),
      last_updated timestamptz DEFAULT now(),
      is_active boolean DEFAULT false
    );

    -- Indexes to enforce single active row where applicable
    CREATE UNIQUE INDEX ux_prompt_versions_one_active ON prompt_versions (category, block_type) WHERE is_active = true;
    CREATE UNIQUE INDEX ux_disclaimers_one_active ON disclaimers (is_active) WHERE is_active = true;

    -- Indexes for messages table
    CREATE INDEX idx_messages_case_id ON messages (case_id);
    CREATE INDEX idx_messages_instructor_id ON messages (instructor_id);

    -- Add foreign key constraints
    ALTER TABLE cases ADD CONSTRAINT fk_cases_student FOREIGN KEY (student_id) REFERENCES users(user_id);
    ALTER TABLE case_feedback ADD CONSTRAINT fk_casefeedback_case FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE;
    ALTER TABLE case_feedback ADD CONSTRAINT fk_casefeedback_author FOREIGN KEY (author_id) REFERENCES users(user_id);
    ALTER TABLE prompt_versions ADD CONSTRAINT fk_promptversions_author FOREIGN KEY (author_id) REFERENCES users(user_id);
    ALTER TABLE summaries ADD CONSTRAINT fk_summaries_case FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE;
    ALTER TABLE annotations ADD CONSTRAINT fk_annotations_summary FOREIGN KEY (summary_id) REFERENCES summaries(summary_id) ON DELETE CASCADE;
    ALTER TABLE annotations ADD CONSTRAINT fk_annotations_author FOREIGN KEY (author_id) REFERENCES users(user_id);
    ALTER TABLE audio_files ADD CONSTRAINT fk_audiofiles_case FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE;
    ALTER TABLE messages ADD CONSTRAINT fk_messages_case FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE messages ADD CONSTRAINT fk_messages_instructor FOREIGN KEY (instructor_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE case_reviewers ADD CONSTRAINT fk_caserev_case FOREIGN KEY (case_id) REFERENCES cases(case_id);
    ALTER TABLE case_reviewers ADD CONSTRAINT fk_caserev_reviewer FOREIGN KEY (reviewer_id) REFERENCES users(user_id);
    ALTER TABLE instructor_students ADD CONSTRAINT fk_instructorstudents_instructor FOREIGN KEY (instructor_id) REFERENCES users(user_id);
    ALTER TABLE instructor_students ADD CONSTRAINT fk_instructorstudents_student FOREIGN KEY (student_id) REFERENCES users(user_id);
    ALTER TABLE disclaimers ADD CONSTRAINT fk_disclaimers_author FOREIGN KEY (author_id) REFERENCES users(user_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS case_feedback CASCADE;
    DROP TABLE IF EXISTS annotations CASCADE;
    DROP TABLE IF EXISTS audio_files CASCADE;
    DROP TABLE IF EXISTS summaries CASCADE;
    DROP TABLE IF EXISTS messages CASCADE;
    DROP TABLE IF EXISTS case_reviewers CASCADE;
    DROP TABLE IF EXISTS instructor_students CASCADE;
    DROP TABLE IF EXISTS prompt_versions CASCADE;
    DROP TABLE IF EXISTS disclaimers CASCADE;
    DROP TABLE IF EXISTS cases CASCADE;
    DROP TABLE IF EXISTS users CASCADE;

    DROP INDEX IF EXISTS ux_prompt_versions_one_active;
    DROP INDEX IF EXISTS ux_disclaimers_one_active;
    DROP INDEX IF EXISTS idx_messages_case_id;
    DROP INDEX IF EXISTS idx_messages_instructor_id;

    DROP TYPE IF EXISTS summary_scope;
    DROP TYPE IF EXISTS prompt_category;
    DROP TYPE IF EXISTS block_type;
    DROP TYPE IF EXISTS case_status;
    DROP TYPE IF EXISTS user_role;
  `);
};