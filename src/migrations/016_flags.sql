-- Flags (»Opozorila«): answers that look unusual are marked for the teacher, who confirms or dismisses the mark.
-- Nothing changes in the points; a flag is only a record. The student sees a confirmed flag, not an open one.
CREATE TABLE flags (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  attempt INT NOT NULL,
  -- the rule that fired (src/flags.js); not limited here so a rule can be added without a migration
  rule TEXT NOT NULL,
  -- numbers only (how many tasks, how many seconds), never the content of an answer
  detail JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'confirmed', 'dismissed')),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 500),
  decided_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- one flag per rule and attempt: a decision is not undone by the next answer
  UNIQUE (user_id, exercise_id, attempt, rule)
);
CREATE INDEX flags_user ON flags(user_id, created_at DESC);
CREATE INDEX flags_open ON flags(created_at) WHERE status = 'open';
