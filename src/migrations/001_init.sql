CREATE TABLE users (
  id            BIGSERIAL PRIMARY KEY,
  oid           TEXT NOT NULL UNIQUE,
  username      TEXT NOT NULL,
  email         TEXT,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','teacher')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE classes (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  owner_id   BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE class_members (
  class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, user_id)
);
CREATE INDEX class_members_user ON class_members(user_id);
CREATE TABLE progress (
  user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id     TEXT NOT NULL,
  attempt         INT NOT NULL DEFAULT 1,
  content_version INT NOT NULL,
  state           JSONB NOT NULL DEFAULT '{}',
  score           NUMERIC(7,1) NOT NULL DEFAULT 0,
  done_count      INT NOT NULL DEFAULT 0,
  hint_count      INT NOT NULL DEFAULT 0,
  solution_count  INT NOT NULL DEFAULT 0,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  PRIMARY KEY (user_id, exercise_id)
);
CREATE TABLE resets (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  attempt     INT NOT NULL,
  score       NUMERIC(7,1) NOT NULL,
  done_count  INT NOT NULL,
  reason      TEXT NOT NULL DEFAULT 'student' CHECK (reason IN ('student','version')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX resets_user ON resets(user_id, exercise_id);
CREATE TABLE task_events (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  attempt     INT NOT NULL,
  task_index  INT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('hint','correct','partial','wrong','solution')),
  points      NUMERIC(4,1) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX task_events_user ON task_events(user_id, exercise_id, created_at);
CREATE TABLE page_time (
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  page_id     TEXT NOT NULL,
  chapter     TEXT NOT NULL,
  seconds     INT NOT NULL DEFAULT 0,
  first_seen  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, exercise_id, page_id)
);
CREATE TABLE exercise_settings (
  exercise_id TEXT PRIMARY KEY,
  visible     BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INT NOT NULL,
  est_minutes INT
);
CREATE TABLE audit_log (
  id         BIGSERIAL PRIMARY KEY,
  actor_id   BIGINT REFERENCES users(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  action     TEXT NOT NULL,
  detail     TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE session (
  sid    VARCHAR NOT NULL PRIMARY KEY,
  sess   JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX session_expire ON session(expire);
