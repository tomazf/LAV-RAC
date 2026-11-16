-- A task with several parts can be answered partly right; the answer is recorded as its own kind of event.
ALTER TABLE task_events DROP CONSTRAINT task_events_kind_check;
ALTER TABLE task_events ADD CONSTRAINT task_events_kind_check CHECK (kind IN ('hint','correct','partial','part','wrong','solution','self'));
