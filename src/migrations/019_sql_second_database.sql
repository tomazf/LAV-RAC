-- SQL sandbox: a second personal database per person (chapter 4.6 has its own, so 4.4 work is not lost).
-- db_name is the 4.4 database, db_name6 the 4.6 one; the account (db_user) is the same. No account existed before this
-- (the SQL server was not set up yet), so the code takes db_name6 as always set.
ALTER TABLE sql_accounts ADD COLUMN db_name6 TEXT UNIQUE;
ALTER TABLE sql_accounts ADD COLUMN size_bytes6 BIGINT NOT NULL DEFAULT 0;
