-- »Nadzorni« (observer): a read-only view of chosen years for a supervisor. No class, no students' progress, nothing saved.
ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('user','teacher','observer'));
ALTER TABLE users ADD COLUMN observer_years SMALLINT[] NOT NULL DEFAULT '{}';
