/* Delete my account from inside the app (#188; Alec, 27 Nov 2026). The database side is
   dailynoodle toolchain/sql/2026-11-28-account-delete.sql, tested there on PGlite. */
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Linking, StyleSheet } from 'react-native';

import { tokensFor } from '@/shared/theme';

import { syncApi } from '../api/syncApi';
import { AccountScreen, deletionRequestUrl } from '../components/AccountScreen/AccountScreen';
import { DELETE_NOT_YET, deleteAccount } from '../hooks/useAccount';
import { fakeClient, memoryStorage } from './fakeClient';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));

const flush = () => act(async () => {});
const light = tokensFor('light');
const flat = (el: { props: { style?: unknown } }) =>
  StyleSheet.flatten(el.props.style as never) as Record<string, unknown>;
const BOARD = { pid: '00000000-0000-4000-8000-0000000000a2', leagues: [] };

beforeEach(() => jest.clearAllMocks());

async function signedIn(opts: Parameters<typeof fakeClient>[0] = {}) {
  const r = fakeClient({
    email: 'alec@example.com',
    remote: { 'digi-mini-v1': { v: 1 } },
    ...opts,
  });
  const store = memoryStorage({ 'noodle-board-v1': BOARD });
  await render(<AccountScreen client={r.client} store={store} />);
  await flush();
  return { ...r, store };
}
const openConfirm = async () => {
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Delete my account' })));
};

describe('GIVEN a signed-in player on Account', () => {
  describe('WHEN they look at Help & privacy', () => {
    it('THEN “Delete my account” is a plain row after Delete my data', async () => {
      await signedIn();
      const card = screen.getByTestId('account-help-card');
      const labels = within(card)
        .getAllByRole('button')
        .map((b) => b.props.accessibilityLabel);
      expect(labels.slice(-2)).toEqual(['Delete my data', 'Delete my account']);
      const row = screen.getByTestId('account-delete-account');
      expect(flat(within(row).getByText('Delete my account')).color).toBe(light.ink);
    });
  });

  describe('WHEN they open it', () => {
    it('THEN the confirm screen says what goes, what happens to league results and what stays, with a red Delete', async () => {
      const { calls } = await signedIn();
      await openConfirm();
      expect(screen.getByRole('header', { name: 'Delete your account?' })).toBeOnTheScreen();
      expect(screen.getByTestId('account-goes')).toHaveTextContent(/alec@example\.com/);
      expect(screen.getByTestId('account-goes')).toHaveTextContent(/can’t be undone/);
      expect(screen.getByTestId('account-league')).toHaveTextContent(/“Former player”/);
      expect(screen.getByTestId('account-league')).toHaveTextContent(/points don’t change/);
      expect(screen.getByTestId('account-stays')).toHaveTextContent(/Everything on this phone/);
      const del = screen.getByTestId('account-delete-confirm');
      expect(flat(del).backgroundColor).toBe(light.badSoft);
      expect(flat(del).backgroundColor).not.toBe(light.accent);
      // Nothing is sent until they confirm.
      expect(calls.map((c) => c.fn)).not.toContain('account_delete');
    });

    it('THEN Keep it goes back and deletes nothing', async () => {
      const { calls, remote } = await signedIn();
      await openConfirm();
      await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Keep it' })));
      expect(screen.getByRole('header', { name: 'Settings' })).toBeOnTheScreen();
      expect(calls.map((c) => c.fn)).not.toContain('account_delete');
      expect(remote).toEqual({ 'digi-mini-v1': { v: 1 } });
    });
  });

  describe('WHEN they confirm', () => {
    it('THEN the phone syncs, the account is deleted, the phone signs out and keeps its results', async () => {
      const { calls, raw, remote, store } = await signedIn();
      await openConfirm();
      await act(async () => fireEvent.press(screen.getByTestId('account-delete-confirm')));
      await flush();
      const fns = calls.map((c) => c.fn);
      // Synced first, so the account holds this phone's league id; then the delete, with no argument.
      expect(fns.indexOf('sync_push_rev')).toBeGreaterThan(-1);
      expect(fns.indexOf('sync_push_rev')).toBeLessThan(fns.indexOf('account_delete'));
      expect(calls.find((c) => c.fn === 'account_delete')!.args).toEqual({});
      expect(fns.filter((f) => f === 'account_delete')).toHaveLength(1);
      expect(remote).toEqual({});
      expect(raw.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
      expect(screen.getByTestId('account-notice')).toHaveTextContent(
        'Your account was deleted. This phone keeps its results.',
      );
      expect(screen.getByTestId('sync-email')).toBeOnTheScreen();
      expect(JSON.parse(store.getItem('noodle-board-v1')!)).toMatchObject(BOARD);
      expect(JSON.parse(store.getItem('digi-mini-v1')!)).toEqual({ v: 1 });
    });

    it('THEN a failure stays on the confirm screen, in the house’s words, still signed in', async () => {
      const r = await signedIn();
      const ok = r.raw.rpc.getMockImplementation()!;
      r.raw.rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) =>
        fn === 'account_delete'
          ? { data: null, error: { message: 'TypeError: Network request failed' } }
          : ok(fn, args),
      );
      await openConfirm();
      await act(async () => fireEvent.press(screen.getByTestId('account-delete-confirm')));
      await flush();
      expect(screen.getByTestId('account-delete-error')).toHaveTextContent(
        'Couldn’t reach the server. Check your connection and try again.',
      );
      expect(screen.queryByText(/TypeError/)).toBeNull();
      expect(r.raw.auth.signOut).not.toHaveBeenCalled();
      // It can be tried again.
      r.raw.rpc.mockImplementation(ok);
      await act(async () => fireEvent.press(screen.getByTestId('account-delete-confirm')));
      await flush();
      expect(screen.getByTestId('account-notice')).toBeOnTheScreen();
    });

    it('THEN before the database can delete accounts, it says so and offers the email request', async () => {
      const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
      const { raw } = await signedIn({ noAccountDelete: true });
      await openConfirm();
      await act(async () => fireEvent.press(screen.getByTestId('account-delete-confirm')));
      await flush();
      expect(screen.getByTestId('account-delete-error')).toHaveTextContent(DELETE_NOT_YET);
      expect(raw.auth.signOut).not.toHaveBeenCalled();
      await act(async () =>
        fireEvent.press(screen.getByRole('button', { name: 'Request account deletion' })),
      );
      expect(spy).toHaveBeenCalledWith(deletionRequestUrl('alec@example.com'));
    });

    it('THEN with no email app for that request, it says where to write', async () => {
      jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));
      await signedIn({ noAccountDelete: true });
      await openConfirm();
      await act(async () => fireEvent.press(screen.getByTestId('account-delete-confirm')));
      await flush();
      await act(async () =>
        fireEvent.press(screen.getByRole('button', { name: 'Request account deletion' })),
      );
      await flush();
      expect(screen.getByTestId('account-mail-failed')).toHaveTextContent(/contact@dailynoodle/);
    });

    it('THEN a failed sync before it doesn’t stop the delete', async () => {
      const r = await signedIn();
      const ok = r.raw.rpc.getMockImplementation()!;
      r.raw.rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) =>
        fn.startsWith('sync_') ? { data: null, error: { message: 'boom' } } : ok(fn, args),
      );
      await openConfirm();
      await act(async () => fireEvent.press(screen.getByTestId('account-delete-confirm')));
      await flush();
      expect(r.calls.map((c) => c.fn)).toContain('account_delete');
      expect(screen.getByTestId('account-notice')).toBeOnTheScreen();
    });
  });
});

describe('GIVEN deleteAccount on its own', () => {
  it('THEN without a sign-in build or a session it refuses in the house’s words, sending nothing', async () => {
    await expect(deleteAccount(memoryStorage(), null)).rejects.toThrow(/isn’t available/);
    const { client, calls } = fakeClient();
    await expect(deleteAccount(memoryStorage(), client)).rejects.toThrow(/Sign in again/);
    expect(calls).toEqual([]);
  });

  it('THEN an answer that isn’t ok is a failure, and a good one is read as the database gives it', async () => {
    const { client, raw } = fakeClient({ email: 'a@example.com' });
    // Any answer the database might give, whatever the stand-in's own types allow.
    const answer = (data: unknown) =>
      raw.rpc.mockImplementationOnce((async () => ({ data, error: null })) as never);
    answer({ ok: false });
    await expect(syncApi(client).deleteAccount()).rejects.toThrow('delete_failed');
    answer({ ok: true, board: 'shared', deleted: 2 });
    await expect(syncApi(client).deleteAccount()).resolves.toEqual({
      ok: true,
      board: 'shared',
      deleted: 2,
    });
    answer({ ok: true, board: 'odd' });
    await expect(syncApi(client).deleteAccount()).resolves.toEqual({
      ok: true,
      board: 'none',
      deleted: 0,
    });
  });
});
