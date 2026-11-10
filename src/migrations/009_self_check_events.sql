-- Tasks of the kind »Sam preveri« have no points; ticking one is recorded as its own kind of event.
ALTER TABLE task_events DROP CONSTRAINT task_events_kind_check;
ALTER TABLE task_events ADD CONSTRAINT task_events_kind_check CHECK (kind IN ('hint','correct','partial','wrong','solution','self'));
