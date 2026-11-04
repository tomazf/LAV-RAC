// Names are listed in Slovene order, by name or by surname.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { byName, bySurname, surname } from '../src/format.js';

const sorted = (names, cmp) => names.map((name) => ({ name })).sort(cmp).map((p) => p.name);

test('č, š and ž come after c, s and z, not at the end of the alphabet', () => {
  assert.deepEqual(sorted(['Žan Zupan', 'Šimen Sever', 'Črt Dolenc', 'Cene Čeh', 'Ana Cvetko', 'Zala Zupan'], byName),
    ['Ana Cvetko', 'Cene Čeh', 'Črt Dolenc', 'Šimen Sever', 'Zala Zupan', 'Žan Zupan']);
  assert.deepEqual(sorted(['Ana Žnidaršič', 'Bor Šuštar', 'Cene Čeh', 'Dasa Cvetko', 'Eva Sever', 'Franc Zupan'], bySurname),
    ['Dasa Cvetko', 'Cene Čeh', 'Eva Sever', 'Bor Šuštar', 'Franc Zupan', 'Ana Žnidaršič']);
});
test('the surname is the last word; the same surname is ordered by given name', () => {
  assert.equal(surname('Ana Marija Kovač'), 'Kovač');
  assert.equal(surname('  Bor  Novak '), 'Novak');
  assert.equal(surname('Madonna'), 'Madonna');
  assert.deepEqual(sorted(['Tina Novak', 'Anja Novak', 'Bor Kovač'], bySurname), ['Bor Kovač', 'Anja Novak', 'Tina Novak']);
});
