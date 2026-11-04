-- Tasks 5, 11 and 12 of exercise 3.2 (positions 4, 10, 11) have new questions.
-- Students solve those tasks again; other answers stay. A new attempt number makes open tabs refresh.
DELETE FROM student_notes WHERE exercise_id='3.2' AND task_index IN (4,10,11);
DELETE FROM task_events e USING progress p
  WHERE e.user_id=p.user_id AND e.exercise_id='3.2' AND p.exercise_id='3.2' AND e.attempt=p.attempt AND e.task_index IN (4,10,11);
UPDATE task_events e SET attempt=e.attempt+1 FROM progress p
  WHERE e.user_id=p.user_id AND e.exercise_id='3.2' AND p.exercise_id='3.2' AND e.attempt=p.attempt;
WITH cleaned AS (
  SELECT user_id, state #- '{t,4}' #- '{t,10}' #- '{t,11}' AS s FROM progress WHERE exercise_id='3.2'
), calc AS (
  SELECT c.user_id, c.s,
    COALESCE(sum((v->>'pts')::numeric) FILTER (WHERE v->>'done'='true'), 0) AS score,
    count(*) FILTER (WHERE v->>'done'='true') AS done,
    count(*) FILTER (WHERE v->>'hinted'='true') AS hints,
    count(*) FILTER (WHERE v->>'done'='true' AND v->>'sol'='true') AS solutions
  FROM cleaned c LEFT JOIN LATERAL jsonb_each(COALESCE(c.s->'t','{}'::jsonb)) AS e(k,v) ON TRUE
  GROUP BY c.user_id, c.s
)
UPDATE progress p SET state=calc.s, score=calc.score, done_count=calc.done, hint_count=calc.hints, solution_count=calc.solutions,
  attempt=p.attempt+1, completed_at=CASE WHEN calc.done >= 18 THEN p.completed_at ELSE NULL END
FROM calc WHERE p.user_id=calc.user_id AND p.exercise_id='3.2';
INSERT INTO audit_log(actor_name, action, detail) VALUES ('sistem','Zamenjal naloge v vaji 3.2','Naloge 5, 11 in 12');
