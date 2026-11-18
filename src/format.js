const TZ = 'Europe/Ljubljana';
const dateFmt = new Intl.DateTimeFormat('sl-SI', { timeZone: TZ, day: 'numeric', month: 'numeric', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('sl-SI', { timeZone: TZ, day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('sl-SI', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
// A day key ("2026-11-15") carries no time zone, so it is read at noon UTC and formatted in UTC.
const dayLabelFmt = new Intl.DateTimeFormat('sl-SI', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' });
export const plural = (n, [one, two, few, many]) => {
  const h = Math.abs(n) % 100;
  return h === 1 ? one : h === 2 ? two : h === 3 || h === 4 ? few : many;
};
export const count = (n, forms) => `${n} ${plural(n, forms)}`;
export const ODGOVOROV = ['odgovor', 'odgovora', 'odgovori', 'odgovorov'];
export const NAMIGOV = ['namig', 'namiga', 'namigi', 'namigov'];
export const NALOG = ['naloga', 'nalogi', 'naloge', 'nalog'];
export const TOCK = ['točka', 'točki', 'točke', 'točk'];
export const DIJAKOV = ['dijak', 'dijaka', 'dijaki', 'dijakov'];
// Names are "Ime Priimek". Slovene order puts č, š and ž after c, s and z, which the database does not do.
const collator = new Intl.Collator('sl');
export const surname = (name) => String(name ?? '').trim().split(/\s+/).pop();
const givenNames = (name) => String(name ?? '').trim().split(/\s+/).slice(0, -1).join(' ');
export const byName = (a, b) => collator.compare(a.name, b.name);
export const bySurname = (a, b) => collator.compare(surname(a.name), surname(b.name)) || collator.compare(givenNames(a.name), givenNames(b.name));
export const num = (x) => String(Math.round((Number(x) || 0) * 10) / 10).replace('.', ',');
export const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
// Minutes up to an hour, then hours and minutes, then days and hours. The thresholds use whole rounded minutes,
// so 59.6 s reads as "1 min" and never as "60 min".
export function duration(sec) {
  const s = Math.round(Number(sec) || 0);
  if (s <= 0) return '0 min';
  if (s < 60) return 'pod 1 min';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ${m % 60} min`;
  return `${Math.floor(h / 24)} d ${h % 24} h`;
}
// The same moment as a file-name stamp in the portal's time zone: "2026-11-18-00-13".
const stampFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export const fileStamp = (d = new Date()) => stampFmt.format(d).replace(/[^0-9]+/g, '-');
export const date = (d) => (d ? dateFmt.format(new Date(d)) : '');
// A class name as it is kept: no stray spaces.
export const cleanName = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
export const time = (d) => (d ? timeFmt.format(new Date(d)) : '');
export const dayLabel = (key) => dayLabelFmt.format(new Date(`${key}T12:00:00Z`));
export const dateTime = (d) => (d ? dateTimeFmt.format(new Date(d)) : '');
export function ago(d) {
  if (!d) return 'še nikoli';
  const min = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (min < 2) return 'pravkar';
  if (min < 60) return `pred ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `pred ${h} h`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'včeraj';
  return days < 14 ? `pred ${days} dnevi` : dateFmt.format(new Date(d));
}
export const dayKey = (d) => new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(new Date(d));
export const csvCell = (v) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
