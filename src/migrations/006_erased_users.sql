-- Remembers who was erased, as a one-way hash of the Entra object id, so that restoring an old
-- backup cannot bring a permanently deleted user back. No name or account is stored.
CREATE TABLE erased_users (
  oid_hash  TEXT PRIMARY KEY,
  erased_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
