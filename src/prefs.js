// Display settings (»Prikaz«): saved per user, written into the <html> tag by the server (portal pages and exercises alike),
// so the page is drawn right the first time and no script of the page has to change anything.
export const PREF_CHOICES = {
  theme: ['auto', 'light', 'dark'],
  size: ['normal', 'large', 'xlarge'],
  spacing: ['normal', 'wide'],
  contrast: ['normal', 'high'],
  motion: ['auto', 'reduce'],
};
export const PREF_DEFAULTS = Object.fromEntries(Object.entries(PREF_CHOICES).map(([k, v]) => [k, v[0]]));
// Anything unknown is dropped and anything missing gets its default, so a stored value can never reach the page unchecked.
export function normalizePrefs(raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return Object.fromEntries(Object.entries(PREF_CHOICES).map(([k, v]) => [k, v.includes(src[k]) ? src[k] : v[0]]));
}
// The attributes for the <html> tag; only what differs from the default, so most pages stay as they were.
export function htmlAttrs(prefs) {
  const p = normalizePrefs(prefs);
  const out = [];
  if (p.theme !== 'auto') out.push(`data-theme="${p.theme}"`);
  if (p.size !== 'normal') out.push(`data-size="${p.size}"`);
  if (p.spacing !== 'normal') out.push(`data-spacing="${p.spacing}"`);
  if (p.contrast !== 'normal') out.push(`data-contrast="${p.contrast}"`);
  if (p.motion !== 'auto') out.push(`data-motion="${p.motion}"`);
  return out.length ? ` ${out.join(' ')}` : '';
}
