-- Display settings (theme, text size, spacing, contrast, motion) are kept per user, so they follow a student between computers.
ALTER TABLE users ADD COLUMN prefs JSONB NOT NULL DEFAULT '{}';

-- Reports (»Prijave«): a student, teacher or supervisor tells the admin about a bug or a mistake in a task or its content.
-- The place (exercise, page, task) is filled in by the page; the class is not stored, it is read from the user when the list is shown.
CREATE TABLE reports (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id TEXT,
  exercise_version INT,
  page_id TEXT,
  task_label TEXT,
  task_no INT,
  path TEXT,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  reply TEXT CHECK (reply IS NULL OR char_length(reply) <= 2000),
  replied_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  -- true after the admin changed the status or wrote a reply, until the author opens the list of their reports
  unseen BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX reports_user ON reports(user_id, created_at DESC);
CREATE INDEX reports_open ON reports(created_at) WHERE status = 'open';
