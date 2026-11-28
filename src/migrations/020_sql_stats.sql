-- SQL sandbox: counters for the admin's statistics (no statement text, no link between a day's counters and what a person wrote)
-- and the result of the admin's last full check, shown to teachers as a simple state.
CREATE TABLE sql_daily (
  day DATE NOT NULL,
  target TEXT NOT NULL,
  runs INT NOT NULL DEFAULT 0,
  failed INT NOT NULL DEFAULT 0,
  ms BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (day, target)
);
-- who was active on a day (only to count people; goes with the user when they are erased)
CREATE TABLE sql_daily_users (
  day DATE NOT NULL,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (day, user_id)
);
ALTER TABLE sql_server ADD COLUMN selftest_at TIMESTAMPTZ;
ALTER TABLE sql_server ADD COLUMN selftest_ok BOOLEAN;
