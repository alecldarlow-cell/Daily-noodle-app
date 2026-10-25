import { LAST_SYNC_KEY, runSync } from '../hooks/syncEngine';
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
      expect(remote['digi-mini-v1']).toEqual(here);
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
      expect(calls.map((c) => c.fn)).toEqual(['sync_pull']);
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
      expect(calls.map((c) => c.fn)).toEqual(['sync_pull']);
    });
  });
});
