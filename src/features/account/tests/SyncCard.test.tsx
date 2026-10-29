import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ago, RESEND_AFTER_S, SyncCard } from '../components/SyncCard/SyncCard';
import { LAST_SYNC_KEY } from '../hooks/syncEngine';
import { fakeClient, memoryStorage } from './fakeClient';

const flush = () => act(async () => {});

describe('GIVEN a build with sync off', () => {
  it('THEN the card isn’t shown', async () => {
    await render(<SyncCard client={null} store={memoryStorage()} />);
    expect(screen.queryByTestId('sync-card')).toBeNull();
  });
});

describe('GIVEN a player who isn’t signed in (AF-004, AF-018)', () => {
  it('THEN the card says “Sign in or create an account”, why, and has a labelled email box', async () => {
    const { client } = fakeClient();
    await render(<SyncCard client={client} store={memoryStorage()} />);
    await flush();
    expect(screen.getByRole('header')).toHaveTextContent('Sign in or create an account');
    expect(
      screen.getByText(
        'Keep your streaks and leagues on every phone and the website. Free, no password: we email you a link.',
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/Create a free account/)).toBeNull();
    expect(screen.getByLabelText('Your email')).toBe(screen.getByTestId('sync-email'));
    expect(screen.getByRole('button', { name: 'Email me a sign-in link' })).toBeOnTheScreen();
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
    expect(screen.getByRole('header')).toHaveTextContent('Check your email');
    expect(screen.getByTestId('sync-sent')).toHaveTextContent(
      'We’ve sent a link to alec@example.com. Open it on this phone.',
    );
    await act(async () =>
      fireEvent.press(screen.getByRole('button', { name: 'Use a different email' })),
    );
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

  describe('WHEN a link has been sent', () => {
    it('THEN “Send again” waits 60 s, counting down, then sends the same email again', async () => {
      jest.useFakeTimers();
      try {
        const { client, raw } = fakeClient();
        await render(<SyncCard client={client} store={memoryStorage()} />);
        await flush();
        await act(async () => fireEvent.changeText(screen.getByTestId('sync-email'), 'a@b.co'));
        await act(async () => fireEvent.press(screen.getByTestId('sync-send')));
        expect(RESEND_AFTER_S).toBe(60);
        const again = () => screen.getByTestId('sync-resend');
        expect(again()).toBeDisabled();
        expect(again()).toHaveTextContent('Send again in 60 s');
        await act(async () => jest.advanceTimersByTime(30_000));
        expect(again()).toHaveTextContent('Send again in 30 s');
        await act(async () => fireEvent.press(again()));
        expect(raw.auth.signInWithOtp).toHaveBeenCalledTimes(1);
        await act(async () => jest.advanceTimersByTime(30_000));
        expect(again()).not.toBeDisabled();
        expect(again()).toHaveTextContent('Send again');
        await act(async () => fireEvent.press(again()));
        expect(raw.auth.signInWithOtp).toHaveBeenCalledTimes(2);
        expect(raw.auth.signInWithOtp).toHaveBeenLastCalledWith({
          email: 'a@b.co',
          options: { emailRedirectTo: 'dailynoodle://auth' },
        });
        // The clock starts again for the next one.
        expect(again()).toBeDisabled();
        expect(again()).toHaveTextContent('Send again in 60 s');
      } finally {
        jest.useRealTimers();
      }
    });
  });
});

describe('GIVEN a signed-in player (AF-018, AF-003)', () => {
  it('THEN “Signed in” is the heading with a tick, the email under it, and one quiet sync line', async () => {
    const store = memoryStorage({ 'digi-mini-v1': { v: 1, done: { A: { s: 1 } } } });
    store.setItem(LAST_SYNC_KEY, JSON.stringify({ at: Date.now() - 54 * 60_000 }));
    const { client, calls } = fakeClient({ email: 'alec@example.com' });
    await render(<SyncCard client={client} store={store} />);
    await flush();
    expect(screen.getByRole('header')).toHaveTextContent('Signed in');
    expect(screen.getByTestId('sync-tick')).toBeOnTheScreen();
    expect(screen.getByTestId('sync-signed-in')).toHaveTextContent('alec@example.com');
    expect(screen.getByTestId('sync-line')).toHaveTextContent(/^Synced 54 min ago ·\s*Sync now$/);
    // Sync now is a text button on that line, not a big button; no delete here.
    expect(screen.getByRole('button', { name: 'Sync now' })).toBeOnTheScreen();
    expect(screen.queryByText(/Delete/)).toBeNull();
    await act(async () => fireEvent.press(screen.getByTestId('sync-now')));
    expect(calls.map((c) => c.fn)).toEqual(['sync_pull', 'sync_push']);
    // One status only: no second “Up to date.” line.
    expect(screen.queryByText('Up to date.')).toBeNull();
    expect(screen.getByTestId('sync-line')).toHaveTextContent(/^Synced just now ·\s*Sync now$/);
  });

  it('THEN while it syncs the line says so', async () => {
    const { client, raw } = fakeClient({ email: 'a@b.co' });
    let release: () => void = () => undefined;
    const rpc = raw.rpc.getMockImplementation()!;
    raw.rpc.mockImplementationOnce(
      (fn: string, args: Record<string, unknown>) =>
        new Promise((r) => {
          release = () => r(rpc(fn, args));
        }) as never,
    );
    await render(<SyncCard client={client} store={memoryStorage()} />);
    await flush();
    await act(async () => fireEvent.press(screen.getByTestId('sync-now')));
    expect(screen.getByTestId('sync-progress')).toHaveTextContent('Syncing…');
    await act(async () => release());
    await flush();
    expect(screen.getByTestId('sync-line')).toHaveTextContent(/^Synced just now ·\s*Sync now$/);
  });

  it('THEN older syncs read in hours and days', async () => {
    expect(ago(null)).toBe('Not synced yet');
    const now = Date.now();
    expect(ago(now - 180 * 60_000, now)).toBe('Synced 3 h ago');
    expect(ago(now - 3 * 24 * 60 * 60_000, now)).toBe('Synced 3 d ago');
  });

  it('THEN “Sign out” is a secondary button that returns to the sign-in form', async () => {
    const { client } = fakeClient({ email: 'a@b.co' });
    await render(<SyncCard client={client} store={memoryStorage()} />);
    await flush();
    expect(screen.getByTestId('sync-line')).toHaveTextContent(/^Not synced yet ·\s*Sync now$/);
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Sign out' })));
    expect(await screen.findByTestId('sync-email')).toBeOnTheScreen();
    expect(screen.getByRole('header')).toHaveTextContent('Sign in or create an account');
  });

  it('THEN signing in after a link was sent, then out again, starts from the email form', async () => {
    const { client, raw } = fakeClient();
    await render(<SyncCard client={client} store={memoryStorage()} />);
    await flush();
    await act(async () => fireEvent.changeText(screen.getByTestId('sync-email'), 'a@b.co'));
    await act(async () => fireEvent.press(screen.getByTestId('sync-send')));
    expect(screen.getByTestId('sync-sent')).toBeOnTheScreen();
    await act(async () => {
      await raw.auth.setSession({ access_token: 'x' });
    });
    expect(screen.getByRole('header')).toHaveTextContent('Signed in');
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Sign out' })));
    expect(screen.getByTestId('sync-email')).toBeOnTheScreen();
  });
});
