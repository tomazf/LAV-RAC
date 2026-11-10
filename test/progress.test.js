// Server rules for points: a self-checked task is done but never worth points, whatever a page claims.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { merge, summarize } from '../src/progress.js';

const ex = {
  format: 'short',
  tasks: [{ i: 0, max: 2 }, { i: 1, max: 0, self: true }, { i: 2, max: 2 }],
};

test('a self task is done with 0 points and its event is recorded as self', () => {
  const r = merge(ex, {}, { t: { 1: { d: true, p: 2 } } });
  assert.equal(r.state.t[1].p, 0);
  assert.equal(r.state.t[1].d, true);
  assert.deepEqual(r.events, [{ task: 1, kind: 'self', points: 0 }]);
  assert.deepEqual(r.summary, { score: 0, done: 1, hints: 0, solutions: 0 });
});
test('a viewed solution on a self task is not a solution that costs points', () => {
  const r = merge(ex, {}, { t: { 1: { d: true, p: 0, sol: true } } });
  assert.deepEqual(r.summary, { score: 0, done: 1, hints: 0, solutions: 0 });
  assert.equal(r.events[0].kind, 'self');
});
test('self tasks do not disturb the points of the others', () => {
  const r = merge(ex, {}, { t: { 0: { d: true, p: 2 }, 1: { d: true, p: 2 }, 2: { d: true, p: 1, sol: true } } });
  assert.equal(r.summary.score, 2);
  assert.equal(r.summary.done, 3);
  assert.equal(r.summary.solutions, 1);
  assert.deepEqual(r.events.map((e) => e.kind), ['correct', 'self', 'solution']);
});
test('a finished self task stays as it was', () => {
  const first = merge(ex, {}, { t: { 1: { d: true } } });
  const again = merge(ex, first.state, { t: { 1: { d: true, p: 2 } } });
  assert.equal(again.state.t[1].p, 0);
  assert.deepEqual(again.events, []);
});
test('summarize counts a stored self task without points even if the state was written with some', () => {
  assert.deepEqual(summarize(ex, { t: { 1: { d: true, p: 2, sol: true } } }), { score: 0, done: 1, hints: 0, solutions: 0 });
});
