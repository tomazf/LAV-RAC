-- The tasks of each exercise version in their order. Students' answers are kept by position, so when a new version
-- moves the tasks, their answers are carried over by the question of each task (src/progress.js, fingerprint).
CREATE TABLE IF NOT EXISTS task_map (
  exercise_id TEXT NOT NULL,
  version INT NOT NULL,
  idx INT NOT NULL,
  fp TEXT NOT NULL,
  PRIMARY KEY (exercise_id, version, idx)
);
