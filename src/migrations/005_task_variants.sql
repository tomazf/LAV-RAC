-- Each attempt gets its own numbers. No seed yet means the original numbers; tasks in variant_keep keep them.
ALTER TABLE progress ADD COLUMN variant_seed INT;
ALTER TABLE progress ADD COLUMN variant_keep INT[] NOT NULL DEFAULT '{}';
