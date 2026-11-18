// The timeline of a student's answers: ranges, buckets per day or per week, and the text of every column.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addDays, buildTimeline, DEFAULT_RANGE, MAX_DAILY, pickRange, schoolYearStart, weekStart } from '../src/timeline.js';
import { duration, fileStamp } from '../src/format.js';

const EX = [
  { id: 'a', no: '2.1', title: 'Prva', strip: [{ i: 0, n: 1 }, { i: 1, n: 2 }, { i: 2, n: 3 }] },
  { id: 'b', no: '2.2', title: 'Druga', strip: [{ i: 0, n: 1 }] },
];
const TODAY = '2026-11-15';
// Winter time: the portal's day is UTC+1.
const ev = (day, time, kind, exercise_id = 'a', task_index = 0) => ({ kind, exercise_id, task_index, created_at: new Date(`${day}T${time}+01:00`) });
const answers = (t) => t.buckets.reduce((a, b) => a + b.answers, 0);

test('an unknown or missing range is the default one', () => {
  for (const v of [undefined, '', 'x', '31', '__proto__']) assert.equal(pickRange(v).id, DEFAULT_RANGE);
  assert.equal(pickRange('leto').id, 'leto');
  assert.equal(DEFAULT_RANGE, '30');
});

test('7, 30 and 90 days give that many daily bars, ending today', () => {
  for (const n of [7, 30, 90]) {
    const t = buildTimeline([], EX, String(n), TODAY);
    assert.equal(t.buckets.length, n);
    assert.equal(t.weekly, false);
    assert.equal(t.buckets.at(-1).start, TODAY);
    assert.equal(t.buckets[0].start, addDays(TODAY, -(n - 1)));
    assert.equal(t.title, `Odgovori v zadnjih ${n} dneh`);
  }
});

test('answers and hints are counted apart, tasks listed once per exercise, other days left out', () => {
  const t = buildTimeline([
    ev('2026-11-12', '10:00:00', 'hint', 'a', 1), ev('2026-11-12', '10:05:00', 'wrong', 'a', 1), ev('2026-11-12', '10:20:00', 'correct', 'a', 1),
    ev('2026-11-12', '12:30:00', 'partial', 'a', 0), ev('2026-11-12', '12:31:00', 'solution', 'b', 0),
    ev('2026-11-11', '09:00:00', 'correct', 'a', 2),
    ev('2026-10-01', '09:00:00', 'correct', 'a', 2), // before the 30 days
    ev('2026-11-16', '09:00:00', 'correct', 'a', 2), // tomorrow
  ], EX, '30', TODAY);
  assert.equal(answers(t), 5);
  const d = t.buckets.find((b) => b.start === '2026-11-12');
  assert.deepEqual([d.answers, d.hints], [4, 1]);
  assert.deepEqual(d.exs.map((e) => [e.no, e.nums]), [['2.1', [1, 2]], ['2.2', [1]]]);
  assert.deepEqual(d.outcomes, [{ text: 'pravilno', n: 1 }, { text: 'pravilno z namigom', n: 1 }, { text: 'napačno', n: 1 }, { text: 'ogledana rešitev', n: 1 }]);
  assert.equal(d.head, '4 odgovori, 1 namig');
  assert.equal(d.hours, '10:00–12:31');
  assert.match(d.aria, /^četrtek, 12\. 11\. 2026: 4 odgovori, 1 namig\. vaja 2\.1, naloge 1, 2\. vaja 2\.2, naloga 1\. pravilno 1, pravilno z namigom 1, napačno 1, ogledana rešitev 1$/);
  assert.equal(t.peak, 4);
  assert.equal(d.height, 100);
  const quiet = t.buckets.find((b) => b.start === '2026-11-13');
  assert.deepEqual([quiet.answers, quiet.height, quiet.hours, quiet.head], [0, 3, '', '']);
  assert.match(quiet.aria, /: brez odgovorov$/);
  assert.equal(t.buckets.find((b) => b.start === '2026-11-11').height, 25);
});

test('the day is the portal day, not UTC', () => {
  const t = buildTimeline([
    { kind: 'correct', exercise_id: 'a', task_index: 0, created_at: new Date('2026-11-14T23:30:00Z') }, // 00:30 on the 15th
    { kind: 'correct', exercise_id: 'a', task_index: 0, created_at: new Date('2026-11-15T22:30:00Z') }, // 23:30 on the 15th
    { kind: 'correct', exercise_id: 'a', task_index: 0, created_at: new Date('2026-11-13T23:30:00Z') }, // 00:30 on the 14th
  ], EX, '7', TODAY);
  assert.deepEqual([t.buckets.at(-1).answers, t.buckets.at(-2).answers], [2, 1]);
});

test('a task or an exercise that no longer exists still counts as an answer', () => {
  const t = buildTimeline([ev('2026-11-15', '10:00:00', 'correct', 'a', 9), ev('2026-11-15', '10:00:00', 'correct', 'gone', 0)], EX, '7', TODAY);
  assert.equal(t.buckets.at(-1).answers, 2);
  assert.deepEqual(t.buckets.at(-1).exs, []);
});

test('the school year starts on 1 September', () => {
  assert.equal(schoolYearStart('2026-09-01'), '2026-09-01');
  assert.equal(schoolYearStart('2026-08-31'), '2025-09-01');
  assert.equal(schoolYearStart('2027-06-20'), '2026-09-01');
  const autumn = buildTimeline([], EX, 'leto', TODAY);
  assert.deepEqual([autumn.weekly, autumn.buckets.length, autumn.buckets[0].start, autumn.title], [false, 76, '2026-09-01', 'Odgovori v šolskem letu 2026/27']);
  const spring = buildTimeline([ev('2026-09-02', '10:00:00', 'correct')], EX, 'leto', '2027-02-10');
  assert.equal(spring.weekly, true);
  assert.equal(spring.buckets[0].start, '2026-08-31'); // the Monday of that week
  assert.equal(spring.buckets[0].end, '2026-09-06');
  assert.equal(spring.buckets[0].answers, 1);
  assert.equal(buildTimeline([], EX, 'leto', '2026-08-20').title, 'Odgovori v šolskem letu 2025/26');
});

test('"all" starts at the first event, per week once it is long, and is never shorter than a week', () => {
  assert.equal(buildTimeline([], EX, 'vse', TODAY).buckets.length, 7);
  assert.equal(buildTimeline([ev('2026-11-13', '10:00:00', 'correct')], EX, 'vse', TODAY).buckets.length, 7);
  const t = buildTimeline([ev('2026-07-08', '10:00:00', 'correct'), ev('2026-11-14', '10:00:00', 'wrong'), ev('2026-11-15', '10:00:00', 'wrong')], EX, 'vse', TODAY);
  assert.equal(t.weekly, true);
  assert.equal(t.unit, 'teden');
  assert.equal(t.title, 'Odgovori od začetka');
  assert.equal(t.buckets[0].start, '2026-07-06'); // Monday
  assert.equal(t.buckets.at(-1).start, '2026-11-09');
  assert.ok(t.buckets.every((b) => weekStart(b.start) === b.start && addDays(b.start, 6) === b.end));
  assert.equal(answers(t), 3);
  assert.equal(t.buckets.at(-1).answers, 2);
  assert.equal(t.buckets.at(-1).hours, ''); // a week has no opening hours
  assert.match(t.buckets.at(-1).label, /^9\. 11\. 2026 – 15\. 11\. 2026$/);
});

test('a range of up to 92 days is drawn per day, a longer one per week', () => {
  assert.equal(MAX_DAILY, 92);
  const edge = (days) => buildTimeline([ev(addDays(TODAY, -(days - 1)), '10:00:00', 'correct')], EX, 'vse', TODAY);
  assert.equal(edge(92).weekly, false);
  assert.equal(edge(92).buckets.length, 92);
  assert.equal(edge(93).weekly, true);
});

test('day arithmetic is not thrown off by a change of the clock', () => {
  assert.equal(addDays('2026-03-28', 2), '2026-03-30');
  assert.equal(addDays('2026-10-24', 2), '2026-10-26');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(weekStart('2026-11-16'), '2026-11-16');
  assert.equal(weekStart('2026-11-15'), '2026-11-09');
  const t = buildTimeline([], EX, '30', '2026-03-31');
  assert.equal(new Set(t.buckets.map((b) => b.start)).size, 30);
});

test('a partly right answer has its own outcome between hinted and wrong', () => {
  const t = buildTimeline([ev('2026-11-12', '10:00:00', 'part', 'a', 0), ev('2026-11-12', '10:01:00', 'wrong', 'a', 1), ev('2026-11-12', '10:02:00', 'partial', 'a', 2)], EX, '30', TODAY);
  const d = t.buckets.find((b) => b.start === '2026-11-12');
  assert.deepEqual(d.outcomes, [{ text: 'pravilno z namigom', n: 1 }, { text: 'delno pravilno', n: 1 }, { text: 'napačno', n: 1 }]);
  assert.match(d.aria, /pravilno z namigom 1, delno pravilno 1, napačno 1$/);
});

test('every time on the timeline reads in minutes, then hours, then days; under a minute is "pod 1 min"', () => {
  assert.equal(duration(0), '0 min');
  assert.equal(duration(40), 'pod 1 min');
  assert.equal(duration(59.4), 'pod 1 min');
  assert.equal(duration(59.6), '1 min'); // rounds to whole minutes, never "60 min"
  assert.equal(duration(45 * 60), '45 min');
  assert.equal(duration(3570), '1 h 0 min'); // 59.5 min rounds up to an hour
  assert.equal(duration(2 * 3600 + 15 * 60), '2 h 15 min');
  assert.equal(duration(23 * 3600 + 59 * 60), '23 h 59 min');
  assert.equal(duration(24 * 3600), '1 d 0 h');
  assert.equal(duration(76 * 3600 + 30 * 60), '3 d 4 h');
});

test('the file name stamp is the local time of the portal', () => {
  // 23:30 UTC is 00:30 in Ljubljana (winter time) on the next day
  assert.equal(fileStamp(new Date('2026-11-17T23:30:00Z')), '2026-11-18-00-30');
  assert.equal(fileStamp(new Date('2026-07-01T10:05:00Z')), '2026-07-01-12-05');
});
