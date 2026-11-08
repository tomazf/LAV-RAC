-- A reset keeps only the score just before it (a safety net for a reset by mistake), not a history of attempts.
DELETE FROM resets r USING resets newer
  WHERE newer.user_id = r.user_id AND newer.exercise_id = r.exercise_id AND newer.id > r.id;
