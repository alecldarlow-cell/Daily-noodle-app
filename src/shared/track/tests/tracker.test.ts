import { announceFinish, announceVisit } from '@/shared/results';

import { logEventsSender } from '../app';
import { createRecorder } from '../recorder';
import { createTracker, IDLE_MS, MAX_BATCH, type TrackEvent } from '../tracker';

function kv(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    m,
  };
}
function setup(init: Record<string, string> = {}) {
  const store = kv(init);
  const sent: TrackEvent[][] = [];
  let n = 0;
  let t = 1_000_000;
  const uuid = () => `${String(++n).padStart(8, '0')}-0000-4000-8000-000000000000`;
  const tracker = createTracker({
    store,
    send: async (b) => void sent.push(b),
    uuid,
    now: () => t,
  });
  const recorder = createRecorder(tracker, uuid);
  const off = recorder.listen();
  return {
    store,
    sent,
    tracker,
    recorder,
    off,
    advance: (ms: number) => (t += ms),
    all: () => sent.flat(),
  };
}
const PATH = 'reports/2026-10-25-crossword-mini-0106.html';

describe('GIVEN a native puzzle played in the app', () => {
  describe('WHEN it is opened, started and finished', () => {
    it('THEN the website’s three events are sent, one visitor and session, marked as the app', () => {
      const h = setup();
      announceVisit({ ev: 'open', path: PATH, type: 'mini' });
      announceVisit({ ev: 'start', path: PATH, type: 'mini' });
      announceVisit({ ev: 'start', path: PATH, type: 'mini' });
      const detail = {
        type: 'crossword-mini',
        tv: 3,
        outcome: 'solved',
        secs: 87,
        checks: 1,
        reveals: 0,
        hints: 0,
      };
      announceFinish({ path: PATH, type: 'mini', detail });
      h.off();
      const ev = h.all();
      expect(ev.map((e) => e.ev)).toEqual(['page_view', 'puzzle_start', 'puzzle_end']);
      expect(new Set(ev.map((e) => e.a)).size).toBe(1);
      expect(new Set(ev.map((e) => e.s)).size).toBe(1);
      expect(new Set(ev.map((e) => e.x.pv)).size).toBe(1);
      expect(ev.every((e) => e.sec === 'puzzles' && e.p === PATH)).toBe(true);
      expect(ev[0]!.x).toMatchObject({
        kind: 'puzzle',
        new: true,
        inst: 2,
        tv: 3,
        via: 'app',
        screen: 'phone',
      });
      expect(ev[1]!.x).toMatchObject({ type: 'crossword-mini', tv: 3 });
      expect(ev[2]!.x).toMatchObject(detail);
      expect(h.store.getItem('digi.aid')).toBe(ev[0]!.a);
    });
  });

  describe('WHEN it finishes with no start recorded, or the site’s own page reported the finish', () => {
    it('THEN a flagged late start goes first, as dn-track.js does; a page’s finish is not sent twice', () => {
      const h = setup();
      announceFinish({ path: PATH, type: 'mini', detail: { outcome: 'solved', secs: 5 } });
      announceFinish({
        path: PATH.replace('mini', 'x'),
        type: 'link',
        detail: { type: 'word-link' },
        source: 'page',
      });
      h.off();
      const ev = h.all();
      expect(ev.map((e) => [e.ev, e.x.late ?? false, e.x.type])).toEqual([
        ['puzzle_start', true, 'crossword-mini'],
        ['puzzle_end', false, 'crossword-mini'],
      ]);
    });
  });

  describe('WHEN the player has opted out on the privacy page', () => {
    it('THEN nothing is sent and no code is made', () => {
      const h = setup({ 'digi.optout': '1' });
      announceVisit({ ev: 'open', path: PATH, type: 'mini' });
      announceFinish({ path: PATH, type: 'mini', detail: {} });
      h.recorder.screen('puzzles.html');
      h.off();
      expect(h.all()).toEqual([]);
      expect(h.store.getItem('digi.aid')).toBeNull();
    });
  });

  describe('WHEN the player comes back after 30 idle minutes, a returning visitor', () => {
    it('THEN the same visitor code, a new session, and new is false', () => {
      const h = setup({ 'digi.aid': 'known', 'digi.sid': 'old', 'digi.last': '999000' });
      h.recorder.screen('puzzles.html');
      h.advance(IDLE_MS + 1);
      h.recorder.screen('puzzles.html');
      h.off();
      const ev = h.all();
      expect(ev.map((e) => e.a)).toEqual(['known', 'known']);
      expect(ev[0]!.s).toBe('old');
      expect(ev[1]!.s).not.toBe('old');
      expect(ev[0]!.x).toMatchObject({ new: false, kind: '' });
      expect(ev[0]!.p).toBe('puzzles.html');
    });
  });

  describe('WHEN many events wait', () => {
    it('THEN they go in batches of 25, and flush sends the rest', () => {
      const h = setup();
      for (let i = 0; i < MAX_BATCH + 3; i++) h.tracker.track('x', {}, 'p', 'pv');
      expect(h.sent.map((b) => b.length)).toEqual([MAX_BATCH]);
      expect(h.tracker.pending()).toBe(3);
      h.tracker.flush();
      expect(h.sent.map((b) => b.length)).toEqual([MAX_BATCH, 3]);
      h.off();
    });
  });
});

describe('GIVEN the app’s sender', () => {
  it('THEN it posts the batch to log_events with the public key, and sends nothing from development builds', async () => {
    const post = jest.fn().mockResolvedValue({ ok: true });
    const env = {
      EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'pk',
    };
    await logEventsSender(
      env,
      false,
      post,
    )([{ a: 'a', s: 's', sec: 'puzzles', ev: 'e', p: 'p', x: {} }]);
    expect(post).toHaveBeenCalledWith('https://x.supabase.co/rest/v1/rpc/log_events', {
      method: 'POST',
      headers: { apikey: 'pk', 'Content-Type': 'application/json' },
      body: JSON.stringify({ batch: [{ a: 'a', s: 's', sec: 'puzzles', ev: 'e', p: 'p', x: {} }] }),
    });
    post.mockClear();
    await logEventsSender(env, true, post)([]);
    await logEventsSender({}, false, post)([]);
    expect(post).not.toHaveBeenCalled();
  });
});
