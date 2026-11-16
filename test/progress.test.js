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

// Partial credit (agreed 16. 11. 2026): a task with several parts answered partly right is worth a share of its points in
// halves of a point, always below what a fully right answer is worth.
const exPart = { format: 'short', tasks: [{ i: 0, max: 3 }, { i: 1, max: 1 }, { i: 2, max: 2 }] };
test('a partly right answer keeps its points in halves, below the full points, and is recorded as part', () => {
  const r = merge(exPart, {}, { t: { 0: { d: true, p: 2.5, f: false, pr: 5, po: 6 } } });
  assert.equal(r.state.t[0].p, 2.5);
  assert.deepEqual(r.events, [{ task: 0, kind: 'part', points: 2.5 }]);
  assert.equal(r.summary.score, 2.5);
});
test('partial points are never more than the task is worth minus half a point, nor in odd fractions', () => {
  assert.equal(merge(exPart, {}, { t: { 0: { d: true, p: 3, f: false } } }).state.t[0].p, 2.5);
  assert.equal(merge(exPart, {}, { t: { 0: { d: true, p: 99, f: false } } }).state.t[0].p, 2.5);
  assert.equal(merge(exPart, {}, { t: { 0: { d: true, p: 1.7, f: false } } }).state.t[0].p, 1.5);
  assert.equal(merge(exPart, {}, { t: { 2: { d: true, p: 2, f: false } } }).state.t[2].p, 1.5);
  assert.equal(merge(exPart, {}, { t: { 1: { d: true, p: 1, f: false } } }).state.t[1].p, 0.5);
});
test('with a hint a partial answer stays below half of the points of the task', () => {
  const r = merge(exPart, {}, { t: { 0: { d: true, h: true, p: 1.5, f: false }, 1: { d: true, h: true, p: 0.5, f: false }, 2: { d: true, h: true, p: 1, f: false } } });
  assert.equal(r.state.t[0].p, 1);
  assert.equal(r.state.t[1].p, 0);
  assert.equal(r.state.t[2].p, 0.5);
  assert.deepEqual(r.events.filter((e) => e.kind !== 'hint').map((e) => e.kind), ['part', 'wrong', 'part']);
});
test('a partial mark with no points is a wrong answer, and without the mark the old rules hold', () => {
  const r = merge(exPart, {}, { t: { 0: { d: true, p: 0, f: false }, 2: { d: true, p: 1.5 } } });
  assert.equal(r.state.t[0].p, 0);
  assert.equal(r.events[0].kind, 'wrong');
  // no `f: false`: 1.5 of 2 is not a legal number of points, it falls back to half of the points
  assert.equal(r.state.t[2].p, 1);
});
test('a partly right task is locked like any other', () => {
  const first = merge(exPart, {}, { t: { 0: { d: true, p: 2, f: false } } });
  const again = merge(exPart, first.state, { t: { 0: { d: true, p: 3 } } });
  assert.equal(again.state.t[0].p, 2);
  assert.deepEqual(again.events, []);
});
