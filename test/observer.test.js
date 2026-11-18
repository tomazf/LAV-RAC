// »Nadzorni« (observer): the chosen years are shown read-only, with solutions, and without the tracker that saves anything.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { observerGroups, renderExercise, byId, yearOf } from '../src/catalog.js';

const sample = [...byId.values()].find((e) => yearOf(e.module) === 2 && e.html);

test('the supervisor sees only the chosen years, in the standard order', () => {
  const groups = observerGroups([2]);
  assert.ok(groups.length > 0);
  for (const m of groups) for (const e of m.exercises) assert.equal(yearOf(e.module), 2);
  assert.deepEqual(observerGroups([]), []);
});

test('the read-only page has its data but no tracker, so nothing is sent or saved', () => {
  assert.ok(sample, 'an exercise of the second year exists');
  const boot = { id: sample.id, no: sample.no, title: sample.title, key: sample.key, attempt: 0, uid: 1, name: 'Nadzor', state: {}, csrf: 'x', staff: true, readOnly: true };
  const html = renderExercise(sample, boot);
  assert.match(html, /window\.__LAVELS=/);
  assert.doesNotMatch(html, /js\/tracker\.js/);
  const normal = renderExercise(sample, { ...boot, readOnly: false });
  assert.match(normal, /js\/tracker\.js/);
});
