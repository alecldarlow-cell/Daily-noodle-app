import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { SyncCard } from '../components/SyncCard/SyncCard';
import { LAST_SYNC_KEY } from '../hooks/syncEngine';
import { fakeClient, memoryStorage } from './fakeClient';

const flush = () => act(async () => {});

describe('GIVEN a build with sync off', () => {
  it('THEN the card isn’t shown', async () => {
    await render(<SyncCard client={null} store={memoryStorage()} />);
    expect(screen.queryByTestId('sync-card')).toBeNull();
  });
});

describe('GIVEN a player who isn’t signed in', () => {
  it('THEN the card says it creates a free account, with a labelled email box', async () => {
    const { client } = fakeClient();
    await render(<SyncCard client={client} store={memoryStorage()} />);
    await flush();
    expect(screen.getByRole('header')).toHaveTextContent('Create a free account');
    expect(screen.getByText('Your email')).toBeOnTheScreen();
    expect(screen.getByLabelText('Your email')).toBe(screen.getByTestId('sync-email'));
  });

  it('THEN a wrong email is explained and a right one gets a link sent to the app', async () => {
    const { client, raw } = fakeClient();
    await render(<SyncCard client={client} store={memoryStorage()} />);
    await flush();
    await act(async () => fireEvent.changeText(screen.getByTestId('sync-email'), 'alec'));
    await act(async () => fireEvent.press(screen.getByTestId('sync-send')));
    expect(await screen.findByTestId('sync-msg')).toHaveTextContent(
      'That doesn’t look like an email address.',
      { exact: false },
    );
    await act(async () =>
      fireEvent.changeText(screen.getByTestId('sync-email'), ' Alec@Example.com '),
    );
    await act(async () => fireEvent.press(screen.getByTestId('sync-send')));
    expect(raw.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'alec@example.com',
      options: { emailRedirectTo: 'dailynoodle://auth' },
    });
    expect(await screen.findByTestId('sync-sent')).toHaveTextContent('alec@example.com', {
      exact: false,
    });
    await act(async () => fireEvent.press(screen.getByText('Use a different email')));
    expect(await screen.findByTestId('sync-email')).toBeOnTheScreen();
  });

  it('THEN a refusal from Supabase is shown in the house’s words, not Supabase’s', async () => {
    const { client } = fakeClient({ fail: 'Email rate limit exceeded' });
    await render(<SyncCard client={client} store={memoryStorage()} />);
    await flush();
    await act(async () => fireEvent.changeText(screen.getByTestId('sync-email'), 'a@b.co'));
    await act(async () => fireEvent.press(screen.getByTestId('sync-send')));
    expect(await screen.findByTestId('sync-msg')).toHaveTextContent(
      'Too many sign-in emails just now. Wait a minute, then try again.',
    );
    expect(screen.queryByText(/rate limit/)).toBeNull();
  });
});

describe('GIVEN a signed-in player', () => {
  it('THEN they see who they are, when they last synced, and can sync now', async () => {
    const store = memoryStorage({ 'digi-mini-v1': { v: 1, done: { A: { s: 1 } } } });
    store.setItem(LAST_SYNC_KEY, JSON.stringify({ at: Date.now() - 5 * 60_000 }));
    const { client, calls } = fakeClient({ email: 'alec@example.com' });
    await render(<SyncCard client={client} store={store} />);
    await flush();
    expect(await screen.findByTestId('sync-signed-in')).toHaveTextContent(
      'Signed in as alec@example.com',
      { exact: false },
    );
    expect(await screen.findByTestId('sync-last')).toHaveTextContent('Synced 5 min ago', {
      exact: false,
    });
    await act(async () => fireEvent.press(screen.getByTestId('sync-now')));
    expect(calls.map((c) => c.fn)).toEqual(['sync_pull', 'sync_push']);
    expect(await screen.findByTestId('sync-msg')).toHaveTextContent('Up to date.', {
      exact: false,
    });
    expect(await screen.findByTestId('sync-last')).toHaveTextContent('Synced just now', {
      exact: false,
    });
  });

  it('THEN signing out keeps the account’s copy; deleting removes it after asking', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    const { client, raw, remote } = fakeClient({
      email: 'alec@example.com',
      remote: { 'digi-mini-v1': { v: 1 } },
    });
    await render(<SyncCard client={client} store={memoryStorage()} />);
    await flush();
    await act(async () => fireEvent.press(screen.getByTestId('sync-delete')));
    const buttons = alert.mock.calls[0]![2] as { text: string; onPress?: () => void }[];
    await act(async () => buttons.find((b) => b.text === 'Delete')!.onPress!());
    expect(remote).toEqual({});
    expect(raw.auth.signOut).toHaveBeenCalled();
    expect(await screen.findByTestId('sync-email')).toBeOnTheScreen();
  });

  it('THEN older syncs read in hours and days', async () => {
    for (const [mins, text] of [
      [180, 'Synced 3 h ago'],
      [3 * 24 * 60, 'Synced 3 d ago'],
    ] as const) {
      const store = memoryStorage();
      store.setItem(LAST_SYNC_KEY, JSON.stringify({ at: Date.now() - mins * 60_000 }));
      const { client } = fakeClient({ email: 'a@b.co' });
      const r = await render(<SyncCard client={client} store={store} />);
      await flush();
      expect(await screen.findByTestId('sync-last')).toHaveTextContent(text, { exact: false });
      await r.unmount();
    }
  });

  it('THEN signing out returns to the sign-in form', async () => {
    const { client } = fakeClient({ email: 'a@b.co' });
    await render(<SyncCard client={client} store={memoryStorage()} />);
    await flush();
    expect(await screen.findByTestId('sync-last')).toHaveTextContent('Not synced yet', {
      exact: false,
    });
    await act(async () => fireEvent.press(screen.getByTestId('sync-signout')));
    expect(await screen.findByTestId('sync-email')).toBeOnTheScreen();
  });
});
