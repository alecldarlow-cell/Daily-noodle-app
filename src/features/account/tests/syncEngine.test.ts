import { KEEP_KEY } from '@noodle/core';

import { LAST_SYNC_KEY, runSync, SyncBusyError, TRIES } from '../hooks/syncEngine';
import { syncApi } from '../api/syncApi';
import { fakeClient, memoryStorage } from './fakeClient';

const read = (s: { getItem(k: string): string | null }, k: string) =>
  JSON.parse(s.getItem(k) ?? 'null');
const PID_A = '11111111-1111-4111-8111-111111111111';
const PID_B = '22222222-2222-4222-8222-222222222222';

describe('GIVEN a signed-in player with saves on this phone and on their account', () => {
  describe('WHEN the phone syncs', () => {
    it('THEN both sides end with every result, the first result for each puzzle kept', async () => {
      const store = memoryStorage({
        'digi-mini-v1': {
          v: 1,
          done: { A: { s: 60, d: '2026-10-24' }, C: { s: 10, d: '2026-10-25' } },
        },
        'noodle-app-today': { today: 'x' },
        'digi-yarn-v1': { v: 1 },
      });
      const { client, remote } = fakeClient({
        email: 'a@b.c',
        remote: {
          'digi-mini-v1': {
            v: 1,
            done: { A: { s: 999, d: '2026-10-23' }, B: { s: 70, d: '2026-10-24' } },
          },
        },
      });
      const r = await runSync(store, syncApi(client), () => 1000);
      const here = read(store, 'digi-mini-v1');
      expect(Object.keys(here.done).sort()).toEqual(['A', 'B', 'C']);
      // The account keeps the first result it stored for A, and this phone keeps its own
      // (the website's rule since 29 Oct 2026, S1); both now hold A, B and C.
      expect(here.done.A).toEqual({ s: 60, d: '2026-10-24' });
      expect(remote['digi-mini-v1']).toEqual({
        ...here,
        done: { ...here.done, A: { s: 999, d: '2026-10-23' } },
      });
      expect(r).toEqual({ pulled: 1, pushed: 1 });
      expect(remote['noodle-app-today']).toBeUndefined();
      expect(remote['digi-yarn-v1']).toBeUndefined();
      expect(read(store, LAST_SYNC_KEY)).toEqual({ at: 1000 });
    });
  });

  describe('WHEN this phone is in no league and the account has one', () => {
    it('THEN this phone becomes that league player', async () => {
      const store = memoryStorage();
      const board = {
        pid: PID_A,
        cur: 'ABCD',
        leagues: [{ code: 'ABCD', name: 'Noodlers', nick: 'Alec', owner: true }],
      };
      const { client } = fakeClient({ email: 'a@b.c', remote: { 'noodle-board-v1': board } });
      await runSync(store, syncApi(client));
      expect(read(store, 'noodle-board-v1')).toMatchObject({ pid: PID_A, cur: 'ABCD' });
    });
  });

  describe('WHEN this phone plays in a league as someone else', () => {
    it('THEN it is never switched silently: the choice is left for the player', async () => {
      const mine = {
        pid: PID_B,
        cur: 'WXYZ',
        leagues: [{ code: 'WXYZ', name: 'Work', nick: 'A', owner: false }],
      };
      const store = memoryStorage({ 'noodle-board-v1': mine });
      const theirs = {
        pid: PID_A,
        cur: 'ABCD',
        leagues: [{ code: 'ABCD', name: 'Noodlers', nick: 'Alec', owner: true }],
      };
      const { client } = fakeClient({ email: 'a@b.c', remote: { 'noodle-board-v1': theirs } });
      await runSync(store, syncApi(client));
      const after = read(store, 'noodle-board-v1');
      expect(after.pid).toBe(PID_B);
      expect(after.pend).toBeTruthy();
    });

    it('THEN until the player chooses, the account keeps its own league player', async () => {
      const mine = { pid: PID_B, cur: 'WXYZ', leagues: [] };
      const store = memoryStorage({
        'noodle-board-v1': { ...mine, leagues: [{ code: 'WXYZ', name: 'Work', nick: 'A' }] },
        'digi-mini-v1': { v: 1, done: { A: { s: 1 } } },
      });
      const theirs = {
        pid: PID_A,
        cur: 'ABCD',
        leagues: [{ code: 'ABCD', name: 'N', nick: 'Alec' }],
      };
      const { client, remote } = fakeClient({
        email: 'a@b.c',
        remote: { 'noodle-board-v1': theirs },
      });
      await runSync(store, syncApi(client));
      expect(remote['noodle-board-v1']).toEqual(theirs);
      expect(remote['digi-mini-v1']).toEqual({ v: 1, done: { A: { s: 1 } } });
    });
  });

  describe('WHEN this phone is already the account’s league player', () => {
    it('THEN its league document is left as it is (no move is marked)', async () => {
      const board = {
        pid: PID_A,
        cur: 'ABCD',
        leagues: [{ code: 'ABCD', name: 'N', nick: 'Alec' }],
      };
      const store = memoryStorage({ 'noodle-board-v1': board });
      const { client, remote } = fakeClient({
        email: 'a@b.c',
        remote: { 'noodle-board-v1': board },
      });
      await runSync(store, syncApi(client));
      expect(read(store, 'noodle-board-v1')).toEqual(board);
      expect(remote['noodle-board-v1']).toEqual(board);
    });
  });

  describe('WHEN there is nothing anywhere', () => {
    it('THEN nothing is pushed', async () => {
      const { client, calls } = fakeClient({ email: 'a@b.c' });
      expect(await runSync(memoryStorage(), syncApi(client))).toEqual({ pulled: 0, pushed: 0 });
      expect(calls.map((c) => c.fn)).toEqual(['sync_pull_rev']);
    });
  });

  describe('WHEN the server refuses', () => {
    it('THEN the sync fails with its reason and the phone keeps its saves', async () => {
      const store = memoryStorage({ 'digi-mini-v1': { v: 1, done: { A: { s: 1 } } } });
      const { client } = fakeClient({ email: 'a@b.c', fail: 'not_signed_in' });
      await expect(runSync(store, syncApi(client))).rejects.toThrow('not_signed_in');
      expect(read(store, 'digi-mini-v1').done.A).toEqual({ s: 1 });
    });
  });

  describe('WHEN the account or this phone holds something unusable', () => {
    it('THEN it is skipped, never pushed or merged', async () => {
      const store = memoryStorage({ 'digi-doku-v1': '{broken' });
      const { client, calls } = fakeClient({
        email: 'a@b.c',
        remote: { 'digi-doku-v1': 3, 'digi-yarn-v1': { v: 1 } },
      });
      await runSync(store, syncApi(client));
      expect(store.getItem('digi-doku-v1')).toBe('{broken');
      expect(store.getItem('digi-yarn-v1')).toBeNull();
      expect(calls.map((c) => c.fn)).toEqual(['sync_pull_rev']);
    });
  });
});

// Plan R3 (29 Oct 2026): revisions with compare-and-swap, as the website's dn-sync.js.
describe('GIVEN two devices on one account (R3)', () => {
  const mini = (id: string, s: number) => ({ v: 1, done: { [id]: { s, d: '2026-10-29' } } });

  describe('WHEN another device writes between this phone pulling and pushing', () => {
    it('THEN nothing is stored, the phone pulls again, merges and retries, and both results end up on the account', async () => {
      const store = memoryStorage({ 'digi-mini-v1': mini('P', 30) });
      let once = true;
      const { client, remote, calls } = fakeClient({
        email: 'a@b.c',
        remote: { 'digi-mini-v1': mini('A', 40) },
        beforePushRev: (r, bump) => {
          if (!once) return;
          once = false;
          r['digi-mini-v1'] = {
            v: 1,
            done: { A: { s: 40, d: '2026-10-29' }, Q: { s: 50, d: '2026-10-29' } },
          };
          bump('digi-mini-v1');
        },
      });
      const r = await runSync(store, syncApi(client));
      expect(calls.map((c) => c.fn)).toEqual([
        'sync_pull_rev',
        'sync_push_rev',
        'sync_pull_rev',
        'sync_push_rev',
      ]);
      expect(Object.keys((remote['digi-mini-v1'] as { done: object }).done).sort()).toEqual([
        'A',
        'P',
        'Q',
      ]);
      expect(Object.keys(read(store, 'digi-mini-v1').done).sort()).toEqual(['A', 'P', 'Q']);
      expect(r.pushed).toBe(1);
    });
  });

  describe('WHEN the phones push in either order from the same start', () => {
    it.each([['phone 1 first'], ['phone 2 first']])(
      'THEN a fresh third phone gets both results (%s)',
      async (order) => {
        const { client, remote } = fakeClient({ email: 'a@b.c' });
        const one = memoryStorage({ 'digi-link-v1': mini('L1', 61) });
        const two = memoryStorage({ 'digi-link-v1': mini('L2', 62) });
        const [a, b] = order === 'phone 1 first' ? [one, two] : [two, one];
        await runSync(a, syncApi(client));
        await runSync(b, syncApi(client));
        const three = memoryStorage();
        await runSync(three, syncApi(client));
        expect(Object.keys(read(three, 'digi-link-v1').done).sort()).toEqual(['L1', 'L2']);
        expect(Object.keys((remote['digi-link-v1'] as { done: object }).done).sort()).toEqual([
          'L1',
          'L2',
        ]);
      },
    );
  });

  describe('WHEN another device keeps writing every time', () => {
    it(`THEN it gives up after ${TRIES} tries with a clear message, and this phone's results stay`, async () => {
      const store = memoryStorage({ 'digi-mini-v1': mini('P', 30) });
      const { client } = fakeClient({
        email: 'a@b.c',
        remote: { 'digi-mini-v1': mini('A', 40) },
        beforePushRev: (_r, bump) => bump('digi-mini-v1'),
      });
      await expect(runSync(store, syncApi(client))).rejects.toBeInstanceOf(SyncBusyError);
      expect(Object.keys(read(store, 'digi-mini-v1').done).sort()).toEqual(['A', 'P']);
    });
  });

  describe('WHEN the account already has every document as this phone does', () => {
    it('THEN nothing is pushed', async () => {
      const doc = mini('A', 40);
      const store = memoryStorage({ 'digi-mini-v1': doc });
      const { client, calls } = fakeClient({ email: 'a@b.c', remote: { 'digi-mini-v1': doc } });
      expect(await runSync(store, syncApi(client))).toEqual({ pulled: 1, pushed: 0 });
      expect(calls.map((c) => c.fn)).toEqual(['sync_pull_rev']);
    });
  });

  describe('WHEN the database has no revision functions yet', () => {
    it('THEN it falls back to the old pull and push', async () => {
      const store = memoryStorage({ 'digi-mini-v1': mini('P', 30) });
      const { client, remote, calls } = fakeClient({
        email: 'a@b.c',
        legacy: true,
        remote: { 'digi-mini-v1': mini('A', 40) },
      });
      await runSync(store, syncApi(client));
      expect(calls.map((c) => c.fn)).toEqual(['sync_pull_rev', 'sync_pull', 'sync_push']);
      expect(Object.keys((remote['digi-mini-v1'] as { done: object }).done).sort()).toEqual([
        'A',
        'P',
      ]);
    });
  });

  describe('WHEN the database refuses for another reason', () => {
    it('THEN the error is not hidden by the fallback', async () => {
      const { client } = fakeClient({ email: 'a@b.c', fail: 'not_signed_in' });
      await expect(runSync(memoryStorage(), syncApi(client))).rejects.toThrow('not_signed_in');
    });
  });
});

// Plan R4 (29 Oct 2026): "Keep this one" is remembered.
describe("GIVEN this phone kept its own league player over the account's (R4)", () => {
  const theirs = {
    pid: PID_A,
    cur: 'ABCD',
    leagues: [{ code: 'ABCD', name: 'Noodlers', nick: 'Alec', owner: true }],
  };
  const mine = {
    pid: PID_B,
    cur: 'WXYZ',
    leagues: [{ code: 'WXYZ', name: 'Work', nick: 'A', owner: false }],
  };

  describe('WHEN the phone syncs again, or after a restart', () => {
    it('THEN it is not asked again, keeps its player, and the account keeps its own', async () => {
      const store = memoryStorage({ 'noodle-board-v1': mine, [KEEP_KEY]: { pids: [PID_A] } });
      const { client, remote } = fakeClient({
        email: 'a@b.c',
        remote: { 'noodle-board-v1': theirs },
      });
      await runSync(store, syncApi(client));
      await runSync(store, syncApi(client));
      expect(read(store, 'noodle-board-v1').pend).toBeUndefined();
      expect(read(store, 'noodle-board-v1').pid).toBe(PID_B);
      expect((remote['noodle-board-v1'] as { pid: string }).pid).toBe(PID_A);
    });
  });

  describe('WHEN a second phone has not made the choice', () => {
    it('THEN that phone is still asked, never switched silently', async () => {
      const store = memoryStorage({ 'noodle-board-v1': mine });
      const { client } = fakeClient({ email: 'a@b.c', remote: { 'noodle-board-v1': theirs } });
      await runSync(store, syncApi(client));
      expect(read(store, 'noodle-board-v1').pid).toBe(PID_B);
      expect(read(store, 'noodle-board-v1').pend).toMatchObject({ pid: PID_A });
    });
  });
});

describe('GIVEN rounds left part-way on two devices (code review, 30 Oct 2026)', () => {
  const LINK = 'DP·LINK·0071';
  const round = (at: number, f: number[]) => ({
    id: LINK,
    f,
    m: 1,
    g: [],
    tr: [],
    l: [],
    s: 40,
    at,
  });

  describe('WHEN a phone holding an older Link round syncs with a newer one on the account', () => {
    it('THEN the phone takes the newer round and the account keeps it', async () => {
      const store = memoryStorage({ 'digi-link-v1': { v: 1, done: {}, cur: round(1000, [1]) } });
      const { client, remote } = fakeClient({
        email: 'a@b.c',
        remote: { 'digi-link-v1': { v: 1, done: {}, cur: round(2000, [1, 2]) } },
      });
      await runSync(store, syncApi(client));
      expect(read(store, 'digi-link-v1').cur.f).toEqual([1, 2]);
      expect((remote['digi-link-v1'] as { cur: { f: number[] } }).cur.f).toEqual([1, 2]);
    });
  });

  describe('WHEN the phone holds the newer Link round', () => {
    it('THEN the phone keeps it and the account gets it', async () => {
      const store = memoryStorage({ 'digi-link-v1': { v: 1, done: {}, cur: round(3000, [3]) } });
      const { client, remote } = fakeClient({
        email: 'a@b.c',
        remote: { 'digi-link-v1': { v: 1, done: {}, cur: round(2000, [1, 2]) } },
      });
      await runSync(store, syncApi(client));
      expect(read(store, 'digi-link-v1').cur.f).toEqual([3]);
      expect((remote['digi-link-v1'] as { cur: { f: number[] } }).cur.f).toEqual([3]);
    });
  });

  const TANGLE = 'DP·TANGLE·0042';
  const playing = { state: 'playing', found: ['ant'], left: 52, score: 1 };
  const done = { state: 'done', found: ['ant', 'tan'], left: 0, score: 2 };
  const result = { o: 'played', s: 2, w: 2, st: false, d: '2026-10-30' };

  describe('WHEN a Tangle day paused and synced is finished on this phone, then synced', () => {
    it('THEN the account holds the finished day, so a new install never offers Resume', async () => {
      const store = memoryStorage({
        'digi-tangle-v1': { v: 1, done: { [TANGLE]: result }, days: { [TANGLE]: done } },
      });
      const { client, remote } = fakeClient({
        email: 'a@b.c',
        remote: { 'digi-tangle-v1': { v: 1, done: {}, days: { [TANGLE]: playing } } },
      });
      await runSync(store, syncApi(client));
      const acc = remote['digi-tangle-v1'] as { days: Record<string, unknown>; done: object };
      expect(acc.days[TANGLE]).toEqual(done);
      expect(acc.done).toEqual({ [TANGLE]: result });

      const fresh = memoryStorage();
      await runSync(fresh, syncApi(client));
      expect(read(fresh, 'digi-tangle-v1').days[TANGLE]).toEqual(done);
    });
  });

  describe('WHEN this phone still has the day in play and the account has it finished', () => {
    it('THEN the phone takes the finished day; finished days on both keep the account’s', async () => {
      const store = memoryStorage({
        'digi-tangle-v1': { v: 1, done: {}, days: { [TANGLE]: playing } },
      });
      const other = { ...done, score: 9 };
      const { client, remote } = fakeClient({
        email: 'a@b.c',
        remote: {
          'digi-tangle-v1': { v: 1, done: { [TANGLE]: result }, days: { [TANGLE]: other } },
        },
      });
      await runSync(store, syncApi(client));
      expect(read(store, 'digi-tangle-v1').days[TANGLE]).toEqual(other);
      expect((remote['digi-tangle-v1'] as { days: Record<string, unknown> }).days[TANGLE]).toEqual(
        other,
      );
    });
  });
});
