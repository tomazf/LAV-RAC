// The SQL sandbox splits a script into statements itself (one statement at a time, errors point at their line).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { firstWord, splitSql } from '../src/sqlsplit.js';

const sqls = (text) => splitSql(text).statements.map((s) => s.sql);

test('sqlsplit: statements end at semicolons outside strings, identifiers and comments', () => {
  assert.deepEqual(sqls('SELECT 1; SELECT 2;'), ['SELECT 1', 'SELECT 2']);
  assert.deepEqual(sqls("SELECT 'a;b', \"c;d\", `e;f`; SELECT 'it''s; ok', 'x\\';y'"), ["SELECT 'a;b', \"c;d\", `e;f`", "SELECT 'it''s; ok', 'x\\';y'"]);
  assert.deepEqual(sqls('-- a; b\nSELECT 1; # c; d\n/* e; f */ SELECT 2'), ['SELECT 1', 'SELECT 2']);
  // "--" without a space is not a comment in MySQL (it is minus minus)
  assert.deepEqual(sqls('SELECT 5--1;'), ['SELECT 5--1']);
  // an executable comment belongs to the statement
  assert.deepEqual(sqls('/*!40101 SET NAMES utf8mb4 */;'), ['/*!40101 SET NAMES utf8mb4 */']);
  assert.deepEqual(sqls('  ;; \n  '), []);
  assert.deepEqual(sqls('SELECT 1'), ['SELECT 1'], 'the last statement does not need a semicolon');
});

test('sqlsplit: each statement knows the line it starts on', () => {
  const { statements } = splitSql("-- uvod\n\nCREATE TABLE t (\n  a INT\n);\nINSERT INTO t VALUES ('x\ny');\n\nSELECT *\nFROM t;");
  assert.deepEqual(statements.map((s) => s.line), [3, 6, 9]);
});

test('sqlsplit: DELIMITER is recognised (a client command the sandbox does not need)', () => {
  assert.equal(splitSql('DELIMITER $$\nSELECT 1$$').delimiter, true);
  assert.equal(splitSql("SELECT 'DELIMITER x';").delimiter, false);
});

test('sqlsplit: the first word skips comments and spaces', () => {
  assert.equal(firstWord('  -- x\n /* y */ delete from t'), 'DELETE');
  assert.equal(firstWord('select 1'), 'SELECT');
  assert.equal(firstWord('(SELECT 1)'), '');
});
