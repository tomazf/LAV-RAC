-- Teachers can reset an exercise for a student.
ALTER TABLE resets DROP CONSTRAINT resets_reason_check;
ALTER TABLE resets ADD CONSTRAINT resets_reason_check CHECK (reason IN ('student','version','teacher'));
-- Deleting a user now erases their name everywhere; clear names left by earlier deletions.
UPDATE audit_log SET detail = '' WHERE action = 'Izbrisal uporabnika in njegove podatke';
