-- A class works on the exercises of its year (letnik). NULL: no year, the class sees every group.
-- show_past lets the whole class revisit the exercises of lower years.
ALTER TABLE classes ADD COLUMN year SMALLINT CHECK (year BETWEEN 1 AND 9);
ALTER TABLE classes ADD COLUMN show_past BOOLEAN NOT NULL DEFAULT FALSE;
