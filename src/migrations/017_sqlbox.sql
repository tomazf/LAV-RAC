-- SQL sandbox (4th year): the MySQL server the admin enters, one database per student or teacher,
-- their saved scripts, the draft in the editor, the last runs, and databases waiting to be dropped after a user is erased.
CREATE TABLE sql_server (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  host TEXT NOT NULL,
  port INT NOT NULL DEFAULT 3306,
  admin_user TEXT NOT NULL,
  admin_pass TEXT NOT NULL,          -- sealed with SQL_KEY
  tls BOOLEAN NOT NULL DEFAULT true,
  ca TEXT,
  prefix TEXT NOT NULL DEFAULT 'lr_',
  limits JSONB NOT NULL DEFAULT '{}',
  server_version TEXT,
  reader_pass TEXT,                  -- sealed; the read-only account of the shared databases
  shared_at TIMESTAMPTZ,
  checked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE sql_accounts (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  db_name TEXT NOT NULL UNIQUE,
  db_user TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,            -- sealed with SQL_KEY
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  last_used_at TIMESTAMPTZ,
  size_bytes BIGINT NOT NULL DEFAULT 0
);
CREATE TABLE sql_scripts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);
CREATE TABLE sql_drafts (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  target TEXT NOT NULL DEFAULT 'moja',
  body TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE sql_history (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target TEXT NOT NULL,
  body TEXT NOT NULL,
  ok BOOLEAN NOT NULL,
  ms INT NOT NULL DEFAULT 0,
  statements INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sql_history_user ON sql_history(user_id, id DESC);
CREATE TABLE sql_drop_queue (
  db_name TEXT PRIMARY KEY,
  db_user TEXT NOT NULL,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
