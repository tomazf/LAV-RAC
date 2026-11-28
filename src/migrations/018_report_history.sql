-- History of the corrections (agreed 28. 11. 2026): a resolved report leaves a summary for the admin. It has no link to the
-- person: when a student is deleted the report goes with them, the summary stays (text, answer, place and dates only).
CREATE TABLE report_history (
  id BIGSERIAL PRIMARY KEY,
  -- the id of the report it was made from (no foreign key: the report may be deleted with its author); one summary per report
  report_id BIGINT NOT NULL UNIQUE,
  exercise_id TEXT,
  page_id TEXT,
  task_label TEXT,
  task_no INT,
  path TEXT,
  body TEXT NOT NULL,
  reply TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  replied_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX report_history_resolved ON report_history(resolved_at DESC);
-- what was resolved before this migration
INSERT INTO report_history(report_id, exercise_id, page_id, task_label, task_no, path, body, reply, created_at, replied_at, resolved_at)
  SELECT id, exercise_id, page_id, task_label, task_no, path, body, reply, created_at, replied_at, COALESCE(resolved_at, updated_at)
  FROM reports WHERE status = 'resolved';
