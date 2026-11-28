// Long actions of the SQL pages (import, full check, creating databases ...) that the page runs in a window with progress.
// The browser asks with the header X-Task: 1 and gets one JSON object per line while the work goes on; without the header (no script)
// the same code runs and the person is sent back to the page with a message.
export class TaskError extends Error {}

export const wantsTask = (req) => req.get('X-Task') === '1';

// What the work reports to: steps (begin/end), an optional planned number of steps (for the progress bar).
const noCtx = { plan() {}, begin: () => 0, end() {}, async run(name, fn) { return fn(); } };

function makeCtx(send) {
  let n = 0;
  const started = new Map();
  const ctx = {
    plan: (total) => send({ type: 'plan', total }),
    begin(name) {
      const id = ++n;
      started.set(id, Date.now());
      send({ type: 'step', id, name, state: 'run' });
      return id;
    },
    // ok: true, false, or null (not run)
    end(id, ok, detail = '') {
      send({ type: 'step', id, state: ok === true ? 'ok' : ok === false ? 'fail' : 'skip', detail: String(detail ?? ''), ms: Date.now() - (started.get(id) ?? Date.now()) });
    },
    async run(name, fn) {
      const id = ctx.begin(name);
      try {
        const d = await fn();
        ctx.end(id, true, typeof d === 'string' ? d : '');
        return d;
      } catch (e) {
        ctx.end(id, false, e.message);
        throw e;
      }
    },
  };
  return ctx;
}

// exec(ctx) returns { message, stats: [[label, value]], extra, go (where the window leads on close), failed } or throws (TaskError and SqlAdminError carry a sentence for people).
export async function stream(res, exec, isUserError) {
  res.status(200).set({ 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
  res.flushHeaders?.();
  const t0 = Date.now();
  const send = (o) => { if (!res.writableEnded) res.write(`${JSON.stringify(o)}\n`); };
  try {
    const r = (await exec(makeCtx(send))) ?? {};
    send({ type: 'done', ok: !r.failed, message: r.message ?? 'Končano.', stats: r.stats ?? [], extra: r.extra ?? null, go: r.go ?? null, ms: Date.now() - t0 });
  } catch (e) {
    const known = e instanceof TaskError || isUserError(e);
    if (!known) console.error('SQL naloga:', e);
    send({ type: 'done', ok: false, message: known ? e.message : 'Nepričakovana napaka na portalu. Podrobnosti so v dnevniku strežnika.', stats: [], extra: null, ms: Date.now() - t0 });
  }
  res.end();
}

// Runs exec for a request: in a window (stream) or, without script, as before (after(result) answers, errors go to fail(message)).
export async function perform(req, res, { after, fail, isUserError }, exec) {
  if (wantsTask(req)) return stream(res, exec, isUserError);
  let r;
  try { r = (await exec(noCtx)) ?? {}; } catch (e) {
    if (e instanceof TaskError || isUserError(e)) return fail(e.message);
    throw e;
  }
  return after(r);
}
