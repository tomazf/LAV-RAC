-- The lower years a class may revisit are now chosen one by one (past_years); show_past meant all of them or none.
ALTER TABLE classes ADD COLUMN past_years SMALLINT[] NOT NULL DEFAULT '{}';
UPDATE classes SET past_years = ARRAY(SELECT generate_series(1, year - 1)::smallint) WHERE show_past AND year > 1;
ALTER TABLE classes DROP COLUMN show_past;
-- Two classes never share a name, ignoring case and spaces. When the data already holds such a pair the index is left out,
-- so that an update never stops on it; the pages check the name anyway.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM classes GROUP BY lower(btrim(name)) HAVING count(*) > 1) THEN
    CREATE UNIQUE INDEX classes_name_key ON classes (lower(btrim(name)));
  END IF;
END $$;
