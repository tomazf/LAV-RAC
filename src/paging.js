// Long admin lists are shown a page at a time. The page and its size come from the query string, so links keep working.
export const PER_PAGE = [10, 20, 50];

export function paging(query, total) {
  const per = PER_PAGE.includes(Number(query.na)) ? Number(query.na) : 20;
  const pages = Math.max(1, Math.ceil(total / per));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(query.stran)) || 1));
  return { per, page, pages, total, offset: (page - 1) * per, from: total ? (page - 1) * per + 1 : 0, to: Math.min(total, page * per) };
}

// A link to the same list with some parameters changed; empty values are left out.
export function listUrl(path, params, change = {}) {
  const all = { ...params, ...change };
  const qs = Object.entries(all).filter(([, v]) => v !== '' && v != null).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return qs ? `${path}?${qs}` : path;
}

// Page numbers to show: the first, the last and the ones around the current page; null marks a gap.
export function pageNumbers({ page, pages }) {
  const out = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 2) out.push(i);
    else if (out.at(-1) !== null) out.push(null);
  }
  return out;
}
