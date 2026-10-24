/**
 * Leagues against the site's own code: dn-board.js and dn-track.js's #dnmove= import run
 * in a sandbox (boardSite.ts) on the same storage and inputs as @noodle/core's ports,
 * and must leave the same storage and send the same server calls. Seeded random cases.
 */
import {
  adoptClaim,
  afterBackfill,
  b64urlDecode,
  b64urlEncode,
  backfillCalls,
  backfillPlan,
  boardPid,
  importMove,
  leaguesFromMine,
  packMove,
  readBoard,
  settlePending,
  submitArgs,
  trackerIds,
  unpackMove,
  writeBoard,
  BOARD_KEY,
  type ClaimResult,
  type FeedPath,
  type MineRow,
} from '../index';
import { loadBoard, runMove, WebStorage } from './boardSite';
import { rng, type Rng } from './gen';

/* eslint-disable @typescript-eslint/no-require-imports */
const { atob, btoa } = require('buffer') as {
  atob(s: string): string;
  btoa(s: string): string;
};

const CASES = 600;
const TYPES = [
  ['mini', 'crossword-mini', 'MINI'],
  ['doku', 'logic-doku', 'LEXI'],
  ['path', 'logic-path', 'PATH'],
  ['sweep', 'logic-sweep', 'SWEEP'],
  ['link', 'word-link', 'LINK'],
  ['tangle', 'word-tangle', 'TANG'],
  ['borders', 'geo-borders', 'BORD'],
  ['reckon', 'quiz-reckon', 'RECK'],
] as const;

const uuid = (g: Rng) =>
  '0000000x-0000-4000-8000-00000000000x'.replace(/x/g, () => g.pick([...'0123456789abcdef']));
const code = (g: Rng) =>
  Array.from({ length: 8 }, () => g.pick([...'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'])).join('');
const nick = (g: Rng) => g.pick(['Alec', 'Ma', 'Piers', 'Zoë', 'Jo 2', '名前', 'A'.repeat(20)]);
const clock = (g: Rng) => `${g.int(0, 12)}:${String(g.int(0, 59)).padStart(2, '0')}`;

function record(g: Rng, t: string, d: string): Record<string, unknown> {
  switch (t) {
    case 'mini':
    case 'doku':
      return { s: g.int(3, 900), d };
    case 'sweep':
      return { o: g.pick(['win', 'loss', 'gave']), s: g.int(3, 900), d };
    case 'path':
      return { t: g.chance(0.9) ? clock(g) : 'x', d };
    case 'link':
      return { o: g.pick(['win', 'loss']), t: clock(g), m: g.int(0, 4), r: [1], g: [[1]], d };
    case 'tangle':
      return { o: 'played', s: g.int(0, 200), w: g.int(0, 30), st: g.chance(0.5), d };
    case 'borders':
      return { c: g.int(0, 10), p: g.int(0, 900), secs: g.int(10, 400), ans: [], on: d };
    default:
      return { p: g.int(0, 1000), b: 1, z: [], g: [], secs: g.int(10, 400), d };
  }
}

/** Puzzle pages, as feed items (some not puzzles), and the ids a player could have saved. */
function feedFor(g: Rng) {
  const feed: FeedPath[] = [];
  const ids: { t: string; id: string }[] = [];
  for (const [t, slug, pre] of TYPES) {
    for (let i = 0; i < g.int(0, 4); i++) {
      const day = g.day('2026-10-20');
      const n = g.int(1, 120);
      const sweep = t === 'sweep';
      const p = sweep
        ? `reports/${day}-${slug}.html`
        : `reports/${day}-${slug}-${String(n).padStart(4, '0')}.html`;
      if (g.chance(0.85)) feed.push({ path: p, kind: g.chance(0.95) ? 'puzzle' : 'piece' });
      ids.push({ t, id: `DP·${pre}·${sweep ? day : String(n).padStart(4, '0')}` });
    }
  }
  return { feed, ids };
}

function league(g: Rng) {
  return {
    code: code(g),
    name: g.pick(['Family', 'Work', 'Noodlers']),
    nick: nick(g),
    owner: g.chance(0.4),
  };
}

function boardState(g: Rng, opts: { leagues?: boolean } = {}) {
  const s: Record<string, unknown> = {};
  if (g.chance(0.85)) s.pid = uuid(g);
  const inLeague = opts.leagues ?? g.chance(0.7);
  if (inLeague) s.leagues = Array.from({ length: g.int(1, 3) }, () => league(g));
  else if (g.chance(0.5)) s.leagues = [];
  if (g.chance(0.5)) s.cur = (s.leagues as { code: string }[] | undefined)?.[0]?.code ?? '';
  if (g.chance(0.3)) s.ptype = g.pick(['all', 'mini', 'link']);
  if (g.chance(0.5)) s.fill = { n: g.int(0, 8), aids: g.chance(0.5) ? [uuid(g)] : [] };
  if (g.chance(0.1)) s.filled = 1;
  return s;
}

function saves(g: Rng, ids: { t: string; id: string }[]) {
  const out: Record<string, string> = {};
  for (const [t] of TYPES) {
    if (!g.chance(0.7)) continue;
    const done: Record<string, unknown> = {};
    for (const x of ids)
      if (x.t === t && g.chance(0.7)) done[x.id] = record(g, t, g.day('2026-10-20'));
    if (g.chance(0.1)) done['DP·X·junk'] = 5;
    const doc: Record<string, unknown> = { v: 1, done };
    if (['tangle', 'borders', 'reckon'].includes(t) && g.chance(0.6))
      doc.streak = { last: g.day('2026-10-20'), n: g.int(0, 9), best: g.int(0, 12) };
    if (t === 'tangle' && g.chance(0.5))
      doc.days = {
        [ids[0]?.id ?? 'x']: { state: g.pick(['ready', 'playing', 'done']), found: [] },
      };
    if (g.chance(0.3)) doc.best = g.int(0, 900);
    if (g.chance(0.3)) doc.snd = g.chance(0.5);
    out[`digi-${t}-v1`] = g.chance(0.03) ? '{not json' : JSON.stringify(doc);
    if (['mini', 'doku', 'sweep', 'path', 'link'].includes(t) && g.chance(0.7)) {
      const dates = Array.from({ length: g.int(0, 5) }, () => g.day('2026-10-20'));
      const last = dates.length ? [...dates].sort().pop() : null;
      const st: Record<string, unknown> = { last, streak: g.int(0, 6), best: g.int(0, 9), dates };
      if (g.chance(0.6)) st.tz = 'L';
      out[`digi-${t}-streak`] = JSON.stringify(st);
    }
  }
  if (g.chance(0.4)) out['digi-yarn-v1'] = JSON.stringify({ v: 1, best: g.int(0, 99) });
  if (g.chance(0.2)) out['digi-echo-cave-v1'] = 'x'.repeat(g.int(1000, 30000));
  if (g.chance(0.2)) out['noodle-board-pinlater'] = '2026-10-24';
  if (g.chance(0.5)) out['digi.aid'] = uuid(g);
  if (g.chance(0.3)) out['digi.aid.prev'] = JSON.stringify([uuid(g)]);
  if (g.chance(0.1)) out['digi.optout'] = '1';
  if (g.chance(0.2)) out['dn-pin'] = '{}';
  return out;
}

const withoutMovedAt = (dump: Record<string, string>) => {
  const s = JSON.parse(dump[BOARD_KEY] ?? 'null');
  if (s && s.moved) s.moved.at = 0;
  return { ...dump, ...(s ? { [BOARD_KEY]: JSON.stringify(s) } : {}) };
};

describe('GIVEN base64url text, as the personal link carries it', () => {
  it('THEN encoding matches btoa(unescape(encodeURIComponent(s))) and decoding matches the site’s b64d', () => {
    const g = rng(51);
    const pool = [...'abc AZ09+/=-_é€😀名\u0000\n"\\', '\ud83d', '\ude00'];
    for (let i = 0; i < 3000; i++) {
      const s = Array.from({ length: g.int(0, 30) }, () => g.pick(pool)).join('');
      let site: string | null;
      try {
        site = btoa(unescape(encodeURIComponent(s)))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');
      } catch {
        site = null;
      }
      let mine: string | null;
      try {
        mine = b64urlEncode(s);
      } catch {
        mine = null;
      }
      expect(mine).toBe(site);
      // Decoding: real links and random junk alike.
      const junk = g.chance(0.5)
        ? (site ?? 'x')
        : Array.from({ length: g.int(0, 12) }, () => g.pick([...'Aa9-_+/=* \né'])).join('');
      let back: string | null;
      try {
        let t = junk.replace(/-/g, '+').replace(/_/g, '/');
        while (t.length % 4) t += '=';
        back = decodeURIComponent(escape(atob(t)));
      } catch {
        back = null;
      }
      expect(b64urlDecode(junk)).toBe(back);
    }
  });
});

describe('GIVEN a personal link opened in an install with saves of its own', () => {
  describe('WHEN the link is unpacked and merged', () => {
    it('THEN the saves and board state are exactly what dn-track.js leaves in a browser', () => {
      const g = rng(52);
      for (let i = 0; i < CASES; i++) {
        const { ids } = feedFor(g);
        // The link, packed by the site's own moveLink from another browser's storage.
        const there = new WebStorage(saves(g, ids));
        if (g.chance(0.9)) there.setItem(BOARD_KEY, JSON.stringify(boardState(g)));
        const thereBoard = readBoard(there);
        if (!thereBoard.pid) writeBoard(there, { ...thereBoard, pid: uuid(g) });
        let link = loadBoard(there).nb.moveLink!() as string;
        if (g.chance(0.05)) link = link.slice(0, g.int(10, link.length)); // cut short in a paste
        if (g.chance(0.03)) link = `${link.split('#')[0]}#dnmove=${b64urlEncode('{"v":2,"d":{}}')}`;

        const here = saves(g, ids);
        if (g.chance(0.8)) here[BOARD_KEY] = JSON.stringify(boardState(g));
        const browser = new WebStorage(here);
        const app = new WebStorage(here);

        runMove(browser, link.slice(link.indexOf('#')));
        const p = unpackMove(link);
        if (p) importMove(app, p, () => 0);
        expect(withoutMovedAt(app.dump())).toEqual(withoutMovedAt(browser.dump()));
      }
    });

    it('THEN hand-made payloads (odd keys, non-JSON values, bad board ids) merge as the site does', () => {
      const g = rng(53);
      for (let i = 0; i < CASES; i++) {
        const { ids } = feedFor(g);
        const d: Record<string, unknown> = saves(g, ids);
        if (g.chance(0.2)) d['digi.aid.prev'] = JSON.stringify([uuid(g)]);
        if (g.chance(0.1)) d.odd = g.chance(0.5) ? 5 : '"str"';
        const b = g.chance(0.8)
          ? {
              pid: g.chance(0.9) ? uuid(g) : 'not-an-id',
              cur: g.chance(0.8) ? code(g) : 5,
              leagues: g.chance(0.9)
                ? [
                    ...Array.from({ length: g.int(0, 12) }, () => league(g)),
                    { code: 'bad code' },
                    7,
                  ]
                : 'x',
            }
          : undefined;
        const hash = `#dnmove=${b64urlEncode(JSON.stringify({ v: 1, d, b, h: '' }))}`;
        const here = saves(g, ids);
        if (g.chance(0.8)) here[BOARD_KEY] = JSON.stringify(boardState(g));
        if (g.chance(0.05)) here[BOARD_KEY] = '[1]';
        const browser = new WebStorage(here);
        const app = new WebStorage(here);
        runMove(browser, hash);
        importMove(app, unpackMove(`https://dailynoodle.co.uk/board.html${hash}`)!, () => 0);
        expect(withoutMovedAt(app.dump())).toEqual(withoutMovedAt(browser.dump()));
      }
    });
  });

  it('THEN anything that is not a personal link is refused', () => {
    expect(unpackMove('https://dailynoodle.co.uk/board.html?join=ABCD2345&v=2')).toBeNull();
    expect(unpackMove('#dnmove=!!!')).toBeNull();
    expect(unpackMove(`#dnmove=${b64urlEncode('[1]')}`)).toBeNull();
    expect(unpackMove(`#dnmove=${b64urlEncode('{"v":1,"d":[]}')}`)).toBeNull();
    expect(importMove(new WebStorage(), { v: 2 } as never)).toBe(false);
    const ok = `#dnmove=${b64urlEncode('{"v":1,"d":{}}')}`;
    expect(unpackMove(` https://x/board.html\n${ok} `)).toEqual({ v: 1, d: {} });
  });
});

describe('GIVEN an install’s saves and board', () => {
  describe('WHEN it packs its personal link', () => {
    it('THEN the link is character for character the one dn-board.js moveLink makes', () => {
      const g = rng(54);
      for (let i = 0; i < CASES; i++) {
        const { ids } = feedFor(g);
        const store = new WebStorage(saves(g, ids));
        store.setItem(BOARD_KEY, JSON.stringify({ ...boardState(g), pid: uuid(g) }));
        const site = loadBoard(store).nb.moveLink!() as string;
        const s = readBoard(store);
        const mine = packMove(
          store,
          [...store.m.keys()],
          { pid: s.pid!, cur: s.cur, leagues: s.leagues as never },
          trackerIds(store)[0],
        );
        expect(mine).toBe(site);
      }
    });

    it('THEN the app’s own caches stay out of it', () => {
      const store = new WebStorage({
        'noodle-app-today': '{"today":"x"}',
        'digi-mini-v1': '{"v":1}',
      });
      const link = packMove(store, [...store.m.keys()], { pid: uuid(rng(1)) });
      expect(unpackMove(link)!.d).toEqual({ 'digi-mini-v1': '{"v":1}' });
    });
  });

  describe('WHEN the board copies its history in', () => {
    it('THEN it sends the same board_backfill calls and records the same fill as dn-board.js', async () => {
      const g = rng(55);
      for (let i = 0; i < CASES; i++) {
        const { feed, ids } = feedFor(g);
        const init = saves(g, ids);
        if (g.chance(0.9)) init[BOARD_KEY] = JSON.stringify({ ...boardState(g), pid: uuid(g) });
        const browser = new WebStorage(init);
        const app = new WebStorage(init);
        const site = loadBoard(browser, () => g.int(0, 3));
        const due = site.nb.backfillDue!(feed);
        await site.nb.backfill!(feed);

        const plan = backfillPlan(app, feed);
        expect(!!plan).toBe(due);
        const sent = plan
          ? backfillCalls(plan).map((c) => ({
              fn: 'board_backfill',
              args: { p_player: readBoard(app).pid, p_aid: c.aid, p_rows: c.rows },
            }))
          : [];
        expect(JSON.stringify(sent)).toBe(JSON.stringify(site.calls));
        if (plan) writeBoard(app, afterBackfill(readBoard(app), plan));
        expect(app.dump()).toEqual(browser.dump());
      }
    });
  });

  describe('WHEN a puzzle ends', () => {
    it('THEN board_submit carries what the site sends for that page, or nothing', () => {
      const g = rng(56);
      for (let i = 0; i < CASES; i++) {
        const [, slug] = g.pick(TYPES);
        const [, otherSlug] = g.pick(TYPES);
        const here = g.chance(0.95)
          ? `reports/${g.day('2026-10-20')}-${slug}-0101.html`
          : `games/${slug}.html`;
        const store = new WebStorage({
          [BOARD_KEY]: JSON.stringify({ ...boardState(g, { leagues: true }), pid: uuid(g) }),
        });
        const site = loadBoard(store, () => true, `/${here}`);
        const detail: Record<string, unknown> = {
          type: g.chance(0.9) ? slug : otherSlug,
          tv: 3,
          outcome: g.pick(['solved', 'failed', 'revealed', 'scored', undefined]),
          secs: g.pick([12, 0, null, undefined, 87.5]),
          score: g.pick([640, 0, null, undefined]),
          mistakes: g.pick([0, 2, null, undefined]),
          checks: 1,
        };
        site.end(detail);
        const args = submitArgs(readBoard(store).pid!, here, detail);
        expect(JSON.stringify(args ? [{ fn: 'board_submit', args }] : [])).toBe(
          JSON.stringify(site.calls),
        );
      }
    });
  });

  describe('WHEN a player is claimed by PIN, or a pending choice is settled', () => {
    it('THEN the saved state is what dn-board.js claim and settlePending leave', async () => {
      const g = rng(57);
      for (let i = 0; i < CASES; i++) {
        const init: Record<string, string> = {};
        if (g.chance(0.9)) init[BOARD_KEY] = JSON.stringify(boardState(g));
        const browser = new WebStorage(init);
        const app = new WebStorage(init);
        const before = readBoard(app);
        const r: ClaimResult = {
          ok: true,
          player: g.chance(0.2) && before.pid ? before.pid : uuid(g),
          code: code(g),
          name: 'Family',
          nick: nick(g),
          needs_pin: g.chance(0.3),
        };
        const mine: MineRow[] = [
          {
            code: r.code!,
            name: 'Family',
            nickname: r.nick!,
            owner: g.chance(0.3),
            members: g.int(1, 9),
            pin: g.chance(0.5),
          },
        ];
        const site = loadBoard(browser, (fn) => (fn === 'board_claim' ? r : mine));
        const out = await site.nb.claim!(r.code, r.nick, '1234');

        const { state, pending } = adoptClaim(before, r);
        expect(pending).toBe(!!out.pending);
        writeBoard(
          app,
          pending ? state : { ...state, leagues: leaguesFromMine(mine), cur: r.code },
        );
        expect(app.dump()).toEqual(browser.dump());

        if (pending) {
          const take = g.chance(0.5);
          site.nb.settlePending!(take);
          writeBoard(app, settlePending(readBoard(app), take));
          expect(app.dump()).toEqual(browser.dump());
        }
      }
    });

    it('THEN a refused claim throws the server’s reason, as the site does', async () => {
      const site = loadBoard(new WebStorage(), () => ({ ok: false, error: 'bad_pin' }));
      await expect(site.nb.claim!('ABCD2345', 'Alec', '0000')).rejects.toMatchObject({
        code: 'bad_pin',
      });
    });
  });

  describe('WHEN the board id is first needed', () => {
    it('THEN one is minted and kept, as dn-board.js pid()', () => {
      const store = new WebStorage();
      const mint = jest.fn(() => '00000000-0000-4000-8000-00000000abcd');
      expect(boardPid(store, mint)).toBe('00000000-0000-4000-8000-00000000abcd');
      expect(boardPid(store, mint)).toBe('00000000-0000-4000-8000-00000000abcd');
      expect(mint).toHaveBeenCalledTimes(1);
      const site = new WebStorage();
      expect(loadBoard(site).nb.pid!()).toBe('00000000-0000-4000-8000-00000000abcd');
      expect(site.dump()).toEqual(store.dump());
    });
  });
});
