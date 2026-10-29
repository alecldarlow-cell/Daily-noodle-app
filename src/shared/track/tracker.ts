/**
 * The website's visit records (dn-track.js), sent the same way from the app, so a play
 * counts the same whether the app plays the puzzle or opens its page (Alec, 25 Oct
 * 2026; the site's SITE.md › App plays count like website plays).
 *
 * Same storage names and rules as dn-track.js: a random visitor code `digi.aid`, a
 * session `digi.sid` that lapses after 30 idle minutes (`digi.last`), and the opt-out
 * `digi.optout` = '1', set by the privacy page's switch (opened in the app's WebView,
 * which shares these keys with the app through the bridge). Opting out deletes the
 * codes and records nothing. Events go in batches of up to 25 to the same
 * `log_events` function, each {a, s, sec, ev, p, x}; app events carry inst 2.
 */
export const IDLE_MS = 30 * 60 * 1000;
export const MAX_BATCH = 25;
export const TRACK_KEY = /^digi\.(aid|sid|last|optout)$/;

/** The app's storage. A removed code is stored as '' (the app's storage keeps no deletes); '' counts as absent. */
export interface TrackKV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  /** When the store can say a key changed: opting out then drops the queue at once. */
  subscribe?(k: string, fn: () => void): () => void;
}

export interface TrackEvent {
  a: string;
  s: string;
  sec: string;
  ev: string;
  p: string;
  x: Record<string, unknown>;
}

export interface TrackerDeps {
  store: TrackKV;
  /** POST a batch; failures are dropped, as the website drops them. */
  send: (batch: TrackEvent[]) => Promise<unknown>;
  uuid: () => string;
  now?: () => number;
}

export function optedOut(store: TrackKV): boolean {
  return store.getItem('digi.optout') === '1';
}

export function createTracker({ store, send, uuid, now = Date.now }: TrackerDeps) {
  const queue: TrackEvent[] = [];
  let isNew = false;
  // Opting out (the privacy page's switch, through the bridge) drops what's queued (R5).
  store.subscribe?.('digi.optout', () => {
    if (optedOut(store)) queue.length = 0;
  });

  function ids(): { a: string; s: string } {
    let a = store.getItem('digi.aid');
    if (!a) {
      a = uuid();
      store.setItem('digi.aid', a);
      isNew = true;
    }
    let s = store.getItem('digi.sid');
    const last = Number(store.getItem('digi.last')) || 0;
    const t = now();
    if (!s || t - last > IDLE_MS) {
      s = uuid();
      store.setItem('digi.sid', s);
    }
    store.setItem('digi.last', String(t));
    return { a, s };
  }

  function flush(): void {
    // An event queued before the player opted out is never sent (R5).
    if (optedOut(store)) {
      queue.length = 0;
      return;
    }
    while (queue.length) {
      const batch = queue.splice(0, MAX_BATCH);
      send(batch).catch(() => undefined);
    }
  }

  function track(ev: string, props: Record<string, unknown>, path: string, pv: string): void {
    if (optedOut(store)) {
      queue.length = 0;
      return;
    }
    const id = ids();
    const x: Record<string, unknown> = { ...props };
    if (!('pv' in x)) x.pv = pv;
    queue.push({ a: id.a, s: id.s, sec: 'puzzles', ev, p: path, x });
    if (queue.length >= MAX_BATCH) flush();
  }

  /** A screen opened, as the page's page_view. `new`: this is the visitor's first code. */
  function pageView(path: string, pv: string, kind: string): void {
    if (optedOut(store)) return;
    isNew = false;
    ids();
    track(
      'page_view',
      { topic: '', kind, new: isNew, ref: '', screen: 'phone', inst: 2, tv: 3, via: 'app' },
      path,
      pv,
    );
    flush();
  }

  return { track, pageView, flush, pending: () => queue.length };
}

export type Tracker = ReturnType<typeof createTracker>;

/** A page-load id, as dn-track.js's PV: the first 8 characters of a fresh uuid. */
export function pageId(uuid: () => string): string {
  return uuid().slice(0, 8);
}
