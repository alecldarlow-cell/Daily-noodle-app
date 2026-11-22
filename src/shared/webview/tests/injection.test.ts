import vm from 'vm';

import { buildInjection, LOAD_KEY, newLoadId } from '../injection';

/** A minimal browser for the injected script: Storage, navigator, document events, the WebView bridge. */
function browser(
  initial: Record<string, string> = {},
  puzzleId = 'DP·TANG·0018',
  session?: { getItem(k: string): string | null; setItem(k: string, v: string): void },
) {
  class Storage {
    private m = new Map<string, string>();
    get length() {
      return this.m.size;
    }
    key(i: number) {
      return [...this.m.keys()][i] ?? null;
    }
    getItem(k: string) {
      return this.m.has(k) ? this.m.get(k)! : null;
    }
    setItem(k: string, v: string) {
      this.m.set(k, String(v));
    }
    removeItem(k: string) {
      this.m.delete(k);
    }
  }
  const localStorage = new Storage();
  for (const [k, v] of Object.entries(initial)) localStorage.setItem(k, v);
  const listeners: Record<string, ((e: unknown) => void)[]> = {};
  const posted: Record<string, unknown>[] = [];
  const win: Record<string, unknown> = {
    localStorage,
    DN_PUZZLE: { id: puzzleId },
    ReactNativeWebView: { postMessage: (s: string) => posted.push(JSON.parse(s)) },
    ...(session ? { sessionStorage: session } : {}),
  };
  const navigator: Record<string, unknown> = { share: () => Promise.reject(new Error('native')) };
  const document = {
    addEventListener: (t: string, fn: (e: unknown) => void) => (listeners[t] ||= []).push(fn),
    dispatch: (t: string, detail: unknown) => listeners[t]?.forEach((fn) => fn({ detail })),
  };
  const ctx = vm.createContext({ window: win, navigator, document, Object, Promise, JSON, String });
  return { ctx, win, localStorage, navigator, document, posted };
}

const MINI = 'digi-mini-v1';
const doc = (x: unknown) => JSON.stringify(x);

describe('GIVEN a puzzle page about to load in the app', () => {
  describe('WHEN the bridge script runs before the page', () => {
    it('THEN the page is marked as the app, for the tracker', () => {
      const b = browser();
      const result = vm.runInContext(buildInjection({}), b.ctx);
      expect(result).toBe(true);
      expect(b.win.__DN_APP).toBe(2);
    });

    it('THEN the app’s saves replace the page’s copies, and only puzzle keys are written', () => {
      const b = browser({ [MINI]: doc({ v: 1, done: { old: { s: 9 } } }) });
      vm.runInContext(
        buildInjection({
          [MINI]: doc({ v: 1, done: { a: { s: 60 } } }),
          'noodle-board-v1': '{}',
          'digi-yarn-v1': '{}',
        }),
        b.ctx,
      );
      expect(JSON.parse(b.localStorage.getItem(MINI)!)).toEqual({ v: 1, done: { a: { s: 60 } } });
      expect(b.localStorage.getItem('noodle-board-v1')).toBeNull();
      expect(b.localStorage.getItem('digi-yarn-v1')).toBeNull();
    });

    it('THEN saves only the page had are sent up to the app, with the open puzzle’s id', () => {
      const b = browser({ 'digi-path-streak': doc({ streak: 2 }), 'digi-yarn-v1': '{}' });
      vm.runInContext(buildInjection({}), b.ctx);
      expect(b.posted).toEqual([
        { t: 'save', key: 'digi-path-streak', value: doc({ streak: 2 }), id: 'DP·TANG·0018' },
      ]);
    });

    it('THEN a seed that could end the script is escaped', () => {
      const b = browser();
      const nasty = '</script><script>window.hacked=1</script> ';
      vm.runInContext(buildInjection({ [MINI]: nasty }), b.ctx);
      expect(b.localStorage.getItem(MINI)).toBe(nasty);
      expect(b.win.hacked).toBeUndefined();
      expect(buildInjection({ [MINI]: nasty })).not.toContain('</script>');
    });
  });

  describe('WHEN the page saves, shares and finishes', () => {
    it('THEN puzzle saves are reported, other keys are not', () => {
      const b = browser();
      vm.runInContext(buildInjection({}), b.ctx);
      b.localStorage.setItem(MINI, doc({ v: 1 }));
      b.localStorage.setItem('dn-today-cache', 'x');
      expect(b.localStorage.getItem(MINI)).toBe(doc({ v: 1 }));
      expect(b.posted).toEqual([
        { t: 'save', key: MINI, value: doc({ v: 1 }), id: 'DP·TANG·0018' },
      ]);
    });

    it('THEN Share goes to the app and resolves, as a native share would', async () => {
      const b = browser();
      vm.runInContext(buildInjection({}), b.ctx);
      await expect(
        (b.navigator.share as (d: unknown) => Promise<void>)({ text: '✏️ Mini #105 — 1:27' }),
      ).resolves.toBeUndefined();
      expect(b.posted).toEqual([{ t: 'share', text: '✏️ Mini #105 — 1:27', url: '' }]);
    });

    it('THEN the site’s finish event is forwarded', () => {
      const b = browser();
      vm.runInContext(buildInjection({}), b.ctx);
      b.document.dispatch('dn:puzzle_end', { type: 'crossword-mini', outcome: 'solved', secs: 87 });
      expect(b.posted).toEqual([
        { t: 'end', detail: { type: 'crossword-mini', outcome: 'solved', secs: 87 } },
      ]);
    });

    it('THEN running the script twice does not double-report', () => {
      const b = browser();
      vm.runInContext(buildInjection({}), b.ctx);
      vm.runInContext(buildInjection({}), b.ctx);
      b.localStorage.setItem(MINI, '{}');
      expect(b.posted).toHaveLength(1);
    });
  });

  describe('WHEN the page and the app share the site tracker’s visitor code (one visitor, web or app)', () => {
    const AID = '11111111-1111-4111-8111-111111111111';
    it('THEN the app’s code, session and opt-out are written into the page; empty ones are not', () => {
      const b = browser({ 'digi.aid': 'old-page-code' });
      vm.runInContext(
        buildInjection({ 'digi.aid': AID, 'digi.sid': 's1', 'digi.last': '5', 'digi.optout': '' }),
        b.ctx,
      );
      expect(b.localStorage.getItem('digi.aid')).toBe(AID);
      expect(b.localStorage.getItem('digi.sid')).toBe('s1');
      expect(b.localStorage.getItem('digi.optout')).toBeNull();
      expect(b.posted).toEqual([]);
    });

    it('THEN a code only the page had goes up to the app', () => {
      const b = browser({ 'digi.aid': AID, 'digi.aid.prev': '[]' });
      vm.runInContext(buildInjection({}), b.ctx);
      expect(b.posted).toEqual([{ t: 'id', key: 'digi.aid', value: AID }]);
    });

    it('THEN opted out in the app, the page has no code either', () => {
      const b = browser({
        'digi.aid': AID,
        'digi.sid': 's',
        'digi.last': '1',
        'digi.aid.prev': '[]',
      });
      vm.runInContext(buildInjection({ 'digi.optout': '1' }), b.ctx);
      expect(b.localStorage.getItem('digi.optout')).toBe('1');
      for (const k of ['digi.aid', 'digi.sid', 'digi.last', 'digi.aid.prev'])
        expect(b.localStorage.getItem(k)).toBeNull();
    });

    it('THEN the page’s later writes and removals of tracker keys reach the app; other keys don’t', () => {
      const b = browser();
      vm.runInContext(buildInjection({}), b.ctx);
      const ls = b.localStorage;
      ls.setItem('digi.optout', '1');
      ls.removeItem('digi.aid');
      ls.setItem('digi.aid.prev', '[]');
      ls.removeItem('something-else');
      expect(b.posted).toEqual([
        { t: 'id', key: 'digi.optout', value: '1' },
        { t: 'id', key: 'digi.aid', value: null },
      ]);
    });
  });
});

/** One WebView's sessionStorage, kept across its page loads (a new browser() is a new document). */
function session() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    m,
  };
}

// Issue #172: the seed is read when the WebView opens; a later load in it must not put it back.
describe('GIVEN a puzzle page that loads again in the same WebView (Reload, a guide page and back)', () => {
  const seed = { [MINI]: doc({ v: 1, done: {} }) };
  const played = doc({ v: 1, done: { a: { s: 41 } } });

  describe('WHEN the page saved a result between the two loads', () => {
    it('THEN the second load keeps the page’s newer save, not the seed from when it opened', () => {
      const ss = session();
      const first = browser({}, 'DP·MINI·0105', ss);
      vm.runInContext(buildInjection(seed, 'mini#0#a'), first.ctx);
      expect(first.localStorage.getItem(MINI)).toBe(seed[MINI]);
      const page = first.localStorage.getItem.bind(first.localStorage);
      first.localStorage.setItem(MINI, played);

      // The same WebView, a new document: same localStorage and sessionStorage, same script.
      const again = browser({ [MINI]: page(MINI)! }, 'DP·MINI·0105', ss);
      vm.runInContext(buildInjection(seed, 'mini#0#a'), again.ctx);
      expect(again.localStorage.getItem(MINI)).toBe(played);
      expect(again.posted).toEqual([]);
      expect(ss.m.get(LOAD_KEY)).toBe('mini#0#a');
    });

    it('THEN a tracker opt-in made on the page is not undone by the app’s old opt-out', () => {
      const ss = session();
      const out = { 'digi.optout': '1' };
      vm.runInContext(buildInjection(out, 'privacy#0#a'), browser({}, '', ss).ctx);
      const again = browser({ 'digi.aid': 'new-code' }, '', ss);
      vm.runInContext(buildInjection(out, 'privacy#0#a'), again.ctx);
      expect(again.localStorage.getItem('digi.aid')).toBe('new-code');
    });
  });

  describe('WHEN a new WebView opens the page (another load name)', () => {
    it('THEN the app’s saves are written again, as on any first load', () => {
      const ss = session();
      vm.runInContext(buildInjection(seed, 'mini#0#a'), browser({}, '', ss).ctx);
      const next = browser({ [MINI]: played }, '', ss);
      vm.runInContext(buildInjection(seed, 'mini#1#a'), next.ctx);
      expect(next.localStorage.getItem(MINI)).toBe(seed[MINI]);
    });
  });

  describe('WHEN the page has no sessionStorage, or it throws', () => {
    it('THEN every load is seeded, as before', () => {
      const none = browser({ [MINI]: played });
      vm.runInContext(buildInjection(seed, 'mini#0#a'), none.ctx);
      expect(none.localStorage.getItem(MINI)).toBe(seed[MINI]);
      const broken = {
        getItem: () => {
          throw new Error('denied');
        },
        setItem: () => {},
      };
      const b = browser({ [MINI]: played }, '', broken);
      expect(vm.runInContext(buildInjection(seed, 'mini#0#a'), b.ctx)).toBe(true);
      expect(b.localStorage.getItem(MINI)).toBe(seed[MINI]);
    });
  });

  describe('WHEN load names are made and written into the script', () => {
    it('THEN each is new, and one that could end the script is escaped', () => {
      expect(newLoadId()).not.toBe(newLoadId());
      const js = buildInjection({}, 'a</script><script>x');
      expect(js).not.toContain('</script>');
    });
  });
});
