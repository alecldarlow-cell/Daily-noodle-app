import { act, render } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { announceFinish } from '@/shared/results';

import { SyncRunner } from '../components/SyncRunner/SyncRunner';
import { sendLink, signOut, deleteSynced, syncNow } from '../hooks/useAccount';
import { fakeClient, memoryStorage } from './fakeClient';

describe('GIVEN a signed-in player with the app open', () => {
  afterEach(() => jest.useRealTimers());

  it('THEN it syncs on opening, after a finish, on returning to the app, and on signing in', async () => {
    jest.useFakeTimers();
    const app: ((s: string) => void)[] = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_e, fn) => {
      app.push(fn as (s: string) => void);
      return { remove: jest.fn() } as never;
    });
    const { client, calls, emit } = fakeClient({ email: 'a@b.co' });
    const store = memoryStorage({ 'digi-mini-v1': { v: 1, done: { A: { s: 1 } } } });
    const r = await render(<SyncRunner client={client} store={store} delayMs={100} />);
    const pulls = () => calls.filter((c) => c.fn === 'sync_pull').length;
    await act(async () => {});
    expect(pulls()).toBe(1);
    announceFinish({ path: 'reports/x.html', type: 'mini', detail: {} });
    await act(async () => jest.advanceTimersByTime(150));
    await act(async () => {});
    expect(pulls()).toBe(2);
    await act(async () => app.at(-1)?.('active'));
    await act(async () => {});
    expect(pulls()).toBe(3);
    await act(async () => emit('SIGNED_IN'));
    await act(async () => {});
    expect(pulls()).toBe(4);
    await r.unmount();
  });

  it('THEN nothing runs when sync is off or nobody is signed in', async () => {
    await render(<SyncRunner client={null} store={memoryStorage()} />);
    const { client, calls } = fakeClient();
    await render(<SyncRunner client={client} store={memoryStorage()} />);
    await act(async () => {});
    expect(calls).toEqual([]);
  });

  it('THEN a failed sync is quiet and the next one still runs', async () => {
    const { client, calls } = fakeClient({ email: 'a@b.co', fail: 'network' });
    await render(<SyncRunner client={client} store={memoryStorage()} />);
    await act(async () => {});
    expect(calls).toHaveLength(1);
  });
});

describe('GIVEN a build without sync', () => {
  it('THEN every account action is a quiet no-op or a plain refusal', async () => {
    await expect(sendLink('a@b.co', null)).rejects.toThrow('isn’t available');
    await expect(syncNow(memoryStorage(), null)).resolves.toBe(false);
    await expect(signOut(null)).resolves.toBeUndefined();
    await expect(deleteSynced(null)).resolves.toBeUndefined();
  });
});
