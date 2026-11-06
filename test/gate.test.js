// Server rules for exercises with a gate: tasks open only after every listed page has been opened.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { merge } from '../src/progress.js';

const ex = {
  format: 'short',
  pages: [{ id: 'pregled' }, { id: 'a' }, { id: 'b' }, { id: 'naloge' }],
  gate: ['a', 'b'],
  tasks: [{ i: 0, max: 2 }, { i: 1, max: 2 }],
};
const done = { t: { 0: { d: true, p: 2 } } };

test('a task cannot be finished before every page of the gate is opened', () => {
  const r = merge(ex, {}, { ...done, seen: ['a'] });
  assert.deepEqual(r.state.t, {});
  assert.equal(r.summary.done, 0);
  assert.deepEqual(r.events, []);
});
test('once all pages are opened the task counts', () => {
  const r = merge(ex, { seen: ['a'] }, { ...done, seen: ['b'] });
  assert.deepEqual(r.state.seen, ['a', 'b']);
  assert.equal(r.summary.score, 2);
});
test('opened pages never disappear and unknown pages are dropped', () => {
  const r = merge(ex, { seen: ['a', 'b'] }, { t: {}, seen: ['x', 'naloge'] });
  assert.deepEqual(r.state.seen, ['a', 'b', 'naloge']);
});
test('hints are kept before the gate opens, so nothing the student did is lost', () => {
  const r = merge(ex, {}, { t: { 1: { h: true, a: ['5'] } } });
  assert.equal(r.state.t[1].h, true);
});
test('an exercise without a gate keeps the old behaviour', () => {
  const r = merge({ ...ex, gate: undefined }, {}, done);
  assert.equal(r.summary.score, 2);
  assert.equal(r.state.seen, undefined);
});
