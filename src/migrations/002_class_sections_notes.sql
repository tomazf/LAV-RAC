-- A class can have several teachers; a teacher can have several classes.
CREATE TABLE class_teachers (
  class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, user_id)
);
CREATE INDEX class_teachers_user ON class_teachers(user_id);
INSERT INTO class_teachers(class_id, user_id) SELECT id, owner_id FROM classes WHERE owner_id IS NOT NULL;
ALTER TABLE classes DROP COLUMN owner_id;

-- Each class has its own open exercises and order. Every class starts with nothing open;
-- the existing order carries over.
CREATE TABLE class_exercises (
  class_id    BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  visible     BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order  INT NOT NULL,
  PRIMARY KEY (class_id, exercise_id)
);
INSERT INTO class_exercises(class_id, exercise_id, visible, sort_order)
  SELECT c.id, s.exercise_id, FALSE, s.sort_order FROM classes c CROSS JOIN exercise_settings s;
DROP TABLE exercise_settings;

-- Teachers are not students of a class.
WITH gone AS (
  DELETE FROM class_members m USING users u WHERE u.id = m.user_id AND u.role = 'teacher' RETURNING u.name
)
INSERT INTO audit_log(actor_name, action, detail) SELECT 'sistem', 'Odstranil učitelja s seznama dijakov', name FROM gone;

-- A student is in one class at most; the earliest membership stays.
WITH ranked AS (
  SELECT class_id, user_id, row_number() OVER (PARTITION BY user_id ORDER BY added_at, class_id) AS n FROM class_members
), gone AS (
  DELETE FROM class_members m USING ranked r
  WHERE m.class_id = r.class_id AND m.user_id = r.user_id AND r.n > 1
  RETURNING m.class_id, m.user_id
)
INSERT INTO audit_log(actor_name, action, detail)
  SELECT 'sistem', 'Odstranil dijaka iz dodatnega razreda', u.name || ': ' || c.name
  FROM gone g JOIN users u ON u.id = g.user_id JOIN classes c ON c.id = g.class_id;
CREATE UNIQUE INDEX class_members_one_class ON class_members(user_id);

-- Student notes. exercise_id '' is the general note; task_index -1 is a note on the whole exercise.
CREATE TABLE student_notes (
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL DEFAULT '',
  task_index  INT NOT NULL DEFAULT -1,
  body        TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, exercise_id, task_index)
);
