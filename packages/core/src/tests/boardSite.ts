/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * The site's leagues code, run as the browser runs it: dn-board.js (vendored verbatim)
 * and dn-track.js's #dnmove= import block, each in a fresh vm sandbox with a fake
 * localStorage, location and fetch. Never imported outside tests.
 */
import vm from 'vm';

declare const __dirname: string;
const fs = require('fs') as { readFileSync(p: string, enc: string): string };
const path = require('path') as { join(...p: string[]): string };
// Node's own atob/btoa: the WHATWG forgiving-base64, as browsers have it.
const { atob, btoa } = require('buffer') as {
  atob(s: string): string;
  btoa(s: string): string;
};

const VENDOR = path.join(__dirname, '..', '..', 'vendor');
const BOARD_JS = fs.readFileSync(path.join(VENDOR, 'dn-board.js'), 'utf8');
const MOVE_JS = fs.readFileSync(path.join(VENDOR, 'dn-move.js'), 'utf8');

/** Web Storage over a Map, with key()/length as moveLink reads them. */
export class WebStorage {
  m = new Map<string, string>();
  constructor(init: Record<string, string> = {}) {
    for (const [k, v] of Object.entries(init)) this.m.set(k, v);
  }
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
  /** Every key and value, sorted, for comparing two stores. */
  dump(): Record<string, string> {
    return Object.fromEntries([...this.m.entries()].sort(([a], [b]) => (a < b ? -1 : 1)));
  }
}

export interface RpcCall {
  fn: string;
  args: Record<string, unknown>;
}

export interface SiteBoard {
  /** window.noodleBoard */
  nb: Record<string, (...a: any[]) => any>;
  calls: RpcCall[];
  /** Fire the page's dn:puzzle_end with a detail. */
  end(detail: unknown): void;
}

/**
 * dn-board.js on a page at `pathname`, with `storage` as its localStorage. Server replies
 * come from `reply(fn, args)`; a reply that is an Error is sent as a 400 with that message.
 */
export function loadBoard(
  storage: WebStorage,
  reply: (fn: string, args: Record<string, unknown>) => unknown = () => null,
  pathname = '/board.html',
): SiteBoard {
  const calls: RpcCall[] = [];
  const listeners: Record<string, ((e: unknown) => void)[]> = {};
  const fetch = (url: string, init: { body: string }) => {
    const fn = String(url).split('/rpc/')[1] ?? '';
    const args = JSON.parse(init.body) as Record<string, unknown>;
    calls.push({ fn, args });
    const r = reply(fn, args);
    const err = r instanceof Error;
    const body = err ? JSON.stringify({ message: r.message }) : JSON.stringify(r ?? null);
    return Promise.resolve({ ok: !err, text: () => Promise.resolve(body) });
  };
  const ctx = vm.createContext({
    localStorage: storage,
    navigator: { userAgent: 'test', platform: 'Linux', maxTouchPoints: 0 },
    location: { pathname, search: '', hash: '' },
    document: {
      readyState: 'complete',
      addEventListener: (t: string, fn: (e: unknown) => void) => (listeners[t] ||= []).push(fn),
      getElementById: () => null,
    },
    fetch,
    crypto: { randomUUID: () => '00000000-0000-4000-8000-00000000abcd' },
    btoa,
  });
  vm.runInContext('this.window = this;', ctx);
  vm.runInContext(BOARD_JS, ctx);
  const nb = (ctx as { noodleBoard: SiteBoard['nb'] }).noodleBoard;
  return {
    nb,
    calls,
    end: (detail) => listeners['dn:puzzle_end']?.forEach((fn) => fn({ detail })),
  };
}

/** dn-track.js's import, as on opening `href`'s fragment in a browser holding `storage`. */
export function runMove(storage: WebStorage, hash: string, now = 0): { reloaded: boolean } {
  let reloaded = false;
  const ctx = vm.createContext({
    localStorage: storage,
    location: { pathname: '/board.html', search: '', hash, reload: () => (reloaded = true) },
    history: { replaceState: () => {} },
    atob,
  });
  vm.runInContext(`this.window = this; Date.now = function () { return ${now}; };`, ctx);
  vm.runInContext(MOVE_JS, ctx);
  return { reloaded };
}
