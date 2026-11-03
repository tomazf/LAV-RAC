const TZ = 'Europe/Ljubljana';
const dateFmt = new Intl.DateTimeFormat('sl-SI', { timeZone: TZ, day: 'numeric', month: 'numeric', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('sl-SI', { timeZone: TZ, day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const plural = (n, [one, two, few, many]) => {
  const h = Math.abs(n) % 100;
  return h === 1 ? one : h === 2 ? two : h === 3 || h === 4 ? few : many;
};
export const count = (n, forms) => `${n} ${plural(n, forms)}`;
export const NALOG = ['naloga', 'nalogi', 'naloge', 'nalog'];
export const TOCK = ['točka', 'točki', 'točke', 'točk'];
export const DIJAKOV = ['dijak', 'dijaka', 'dijaki', 'dijakov'];
export const num = (x) => String(Math.round((Number(x) || 0) * 10) / 10).replace('.', ',');
export const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
export function duration(sec) {
  const s = Math.round(Number(sec) || 0);
  if (s <= 0) return '0 min';
  if (s < 60) return 'manj kot 1 min';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}
export const date = (d) => (d ? dateFmt.format(new Date(d)) : '');
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
