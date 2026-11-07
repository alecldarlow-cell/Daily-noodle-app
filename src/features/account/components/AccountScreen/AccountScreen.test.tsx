import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Linking, StyleSheet } from 'react-native';

import { buildLine } from '@/shared/build';
import { APP_SETTINGS_KEY, DEFAULT_SETTINGS, readSettings, saveSettings } from '@/shared/settings';
import { appStorage } from '@/shared/storage';
import { tokensFor } from '@/shared/theme';

import { fakeClient, memoryStorage } from '../../tests/fakeClient';
import { AccountScreen, CONTACT_EMAIL, deletionRequestUrl } from './AccountScreen';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));

const flush = () => act(async () => {});
const light = tokensFor('light');
const flat = (el: { props: { style?: unknown } }) =>
  StyleSheet.flatten(el.props.style as never) as Record<string, unknown>;

beforeEach(() => {
  jest.clearAllMocks();
  saveSettings(DEFAULT_SETTINGS);
});

describe('GIVEN the Account tab in a build without sign-in', () => {
  describe('WHEN it opens', () => {
    it('THEN it shows Settings and Help & privacy, then the version: no sign-in, no Leagues card', async () => {
      await render(<AccountScreen client={null} />);
      expect(screen.getByRole('header', { name: 'Account' })).toBeOnTheScreen();
      expect(screen.queryByTestId('sync-card')).toBeNull();
      expect(screen.queryByRole('header', { name: 'Your account' })).toBeNull();
      for (const name of ['Settings', 'Help & privacy'])
        expect(screen.getByRole('header', { name })).toBeOnTheScreen();
      // Alec, 7 Nov 2026: joining a league is on Leagues only.
      expect(screen.queryByRole('header', { name: 'Leagues' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Join with a code' })).toBeNull();
      // Nothing synced, no account: no delete row.
      expect(screen.queryByTestId('account-delete')).toBeNull();
      expect(screen.getByTestId('account-build')).toHaveTextContent(buildLine());
    });

    it('THEN Help & privacy is one card: How to play, Privacy, Contact us, in that order', async () => {
      await render(<AccountScreen client={null} />);
      const card = screen.getByTestId('account-help-card');
      const links = within(card)
        .getAllByRole('link')
        .map((l) => l.props.accessibilityLabel);
      expect(links).toEqual(['How to play', 'Privacy', 'Contact us']);
    });
  });

  describe('WHEN the player taps How to play', () => {
    it('THEN the guide opens inside the app, at the top', async () => {
      await render(<AccountScreen client={null} />);
      await fireEvent.press(screen.getByRole('link', { name: 'How to play' }));
      expect(router.navigate).toHaveBeenCalledWith('/how-to-play');
    });
  });

  describe('WHEN the player taps the privacy row (AF-001)', () => {
    it('THEN it reads just “Privacy” (Alec, 7 Nov 2026), and the privacy page opens inside the app', async () => {
      await render(<AccountScreen client={null} />);
      const row = screen.getByRole('link', { name: 'Privacy' });
      expect(row.props.accessibilityHint).toBeUndefined();
      expect(screen.queryByText(/What’s recorded/)).toBeNull();
      await fireEvent.press(row);
      expect(router.navigate).toHaveBeenCalledWith('/privacy');
      expect(screen.queryByText(/how to stop it/)).toBeNull();
    });
  });

  describe('WHEN the player taps Contact us', () => {
    it('THEN an email to us opens', async () => {
      const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
      await render(<AccountScreen client={null} />);
      await act(async () => fireEvent.press(screen.getByRole('link', { name: 'Contact us' })));
      expect(open).toHaveBeenCalledWith(`mailto:${CONTACT_EMAIL}`);
      expect(screen.queryByTestId('account-mail-failed')).toBeNull();
    });

    it('THEN with no email app, it gives the address instead', async () => {
      jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));
      await render(<AccountScreen client={null} />);
      await act(async () => fireEvent.press(screen.getByRole('link', { name: 'Contact us' })));
      await flush();
      expect(screen.getByTestId('account-mail-failed')).toHaveTextContent(CONTACT_EMAIL, {
        exact: false,
      });
    });
  });
});

describe('GIVEN the app-wide settings on Account (AF-012)', () => {
  describe('WHEN the player switches Vibration off, then on', () => {
    it('THEN it is on by default, and each change is saved under the app’s new key', async () => {
      await render(<AccountScreen client={null} />);
      const sw = screen.getByLabelText('Vibration');
      expect(sw.props.value).toBe(true);
      await act(async () => fireEvent(sw, 'valueChange', false));
      expect(readSettings().vibration).toBe(false);
      expect(JSON.parse(appStorage.getItem(APP_SETTINGS_KEY)!)).toMatchObject({
        vibration: false,
      });
      expect(screen.getByLabelText('Vibration').props.value).toBe(false);
      await act(async () => fireEvent(screen.getByLabelText('Vibration'), 'valueChange', true));
      expect(readSettings().vibration).toBe(true);
    });
  });

  describe('WHEN the player switches Animations off, then on', () => {
    it('THEN it is a plain switch: on follows the phone, off is reduced, and each is saved', async () => {
      await render(<AccountScreen client={null} />);
      const sw = screen.getByLabelText('Animations');
      expect(sw.props.value).toBe(true);
      expect(screen.queryByRole('radio')).toBeNull();
      await act(async () => fireEvent(sw, 'valueChange', false));
      expect(readSettings().motion).toBe('reduced');
      expect(JSON.parse(appStorage.getItem(APP_SETTINGS_KEY)!)).toMatchObject({
        motion: 'reduced',
      });
      expect(screen.getByLabelText('Animations').props.value).toBe(false);
      await act(async () => fireEvent(screen.getByLabelText('Animations'), 'valueChange', true));
      expect(readSettings().motion).toBe('phone');
    });
  });

  describe('WHEN the settings show', () => {
    it('THEN they are three switches, Vibration, Sound and Animations, with no descriptions', async () => {
      await render(<AccountScreen client={null} />);
      const card = screen.getByTestId('settings-card');
      expect(
        within(card)
          .getAllByRole('switch')
          .map((s) => s.props.accessibilityLabel),
      ).toEqual(['Vibration', 'Sound', 'Animations']);
      expect(card).toHaveTextContent(/^VibrationSoundAnimations$/);
    });
  });

  describe('WHEN the player switches Sound off, then on (AF-012, AF-013)', () => {
    it('THEN it is on by default, saved under the same key, and Vibration is left alone', async () => {
      await render(<AccountScreen client={null} />);
      const sw = screen.getByLabelText('Sound');
      expect(sw.props.value).toBe(true);
      await act(async () => fireEvent(sw, 'valueChange', false));
      expect(readSettings()).toMatchObject({ sound: false, vibration: true });
      expect(JSON.parse(appStorage.getItem(APP_SETTINGS_KEY)!)).toMatchObject({ sound: false });
      expect(screen.getByLabelText('Sound').props.value).toBe(false);
      await act(async () => fireEvent(screen.getByLabelText('Sound'), 'valueChange', true));
      expect(readSettings().sound).toBe(true);
    });
  });
});

describe('GIVEN a signed-out player in a build with sign-in', () => {
  it('THEN the sign-in card sits under a “Your account” section label, as Settings and Help & privacy do', async () => {
    const { client } = fakeClient();
    await render(<AccountScreen client={client} store={memoryStorage()} />);
    await flush();
    expect(screen.getByRole('header', { name: 'Your account' })).toBeOnTheScreen();
    expect(screen.getByTestId('sync-card')).toBeOnTheScreen();
  });

  it('THEN Delete my data offers only the account request: there is no saved copy to delete', async () => {
    const { client } = fakeClient();
    await render(<AccountScreen client={client} store={memoryStorage()} />);
    await flush();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Delete my data' })));
    expect(screen.getByRole('header', { name: 'Delete your account' })).toBeOnTheScreen();
    expect(screen.queryByTestId('delete-confirm')).toBeNull();
    expect(screen.getByTestId('account-request-deletion')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Cancel' })));
    expect(screen.getByRole('header', { name: 'Settings' })).toBeOnTheScreen();
  });
});

describe('GIVEN a signed-in player', () => {
  const signedIn = async (opts: { fail?: string } = {}) => {
    const r = fakeClient({ email: 'alec@example.com', remote: { 'digi-mini-v1': { v: 1 } } });
    const fail = opts.fail;
    if (fail) {
      const ok = r.raw.rpc.getMockImplementation()!;
      r.raw.rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) =>
        fn === 'sync_forget' ? { data: null, error: { message: fail } } : ok(fn, args),
      );
    }
    await render(<AccountScreen client={r.client} store={memoryStorage()} />);
    await flush();
    return r;
  };

  describe('WHEN they open “Delete my data”', () => {
    it('THEN it is a plain row, and the confirm screen says what goes and what stays', async () => {
      await signedIn();
      const row = screen.getByRole('button', { name: 'Delete my data' });
      // A plain row in ink, not a red control.
      expect(flat(within(row).getByText('Delete my data')).color).toBe(light.ink);
      await act(async () => fireEvent.press(row));
      expect(screen.getByRole('header', { name: 'Delete your saved data?' })).toBeOnTheScreen();
      expect(screen.getByTestId('delete-goes')).toHaveTextContent(/kept for alec@example\.com/);
      expect(screen.getByTestId('delete-goes')).toHaveTextContent(/signed out/);
      expect(screen.getByTestId('delete-stays')).toHaveTextContent(/Everything on this phone/);
      // Both kinds of deleting, each saying what it does.
      expect(screen.getByRole('header', { name: 'Delete your account' })).toBeOnTheScreen();
      expect(screen.getByTestId('delete-account-says')).toHaveTextContent(/sign-in email/);
      const del = screen.getByRole('button', { name: 'Delete' });
      // Red, and never the filled accent.
      expect(flat(del).backgroundColor).toBe(light.badSoft);
      expect(flat(del).backgroundColor).not.toBe(light.accent);
      expect(flat(within(del).getByText('Delete')).color).toBe(light.bad);
    });

    it('THEN Cancel goes back and deletes nothing', async () => {
      const { remote } = await signedIn();
      await act(async () =>
        fireEvent.press(screen.getByRole('button', { name: 'Delete my data' })),
      );
      await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Cancel' })));
      expect(screen.getByRole('header', { name: 'Settings' })).toBeOnTheScreen();
      expect(remote).toEqual({ 'digi-mini-v1': { v: 1 } });
    });

    it('THEN Delete removes the synced copy, signs out, and says what happened', async () => {
      const { remote, raw } = await signedIn();
      await act(async () =>
        fireEvent.press(screen.getByRole('button', { name: 'Delete my data' })),
      );
      await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Delete' })));
      await flush();
      expect(remote).toEqual({});
      expect(raw.auth.signOut).toHaveBeenCalled();
      expect(screen.getByTestId('account-notice')).toHaveTextContent(
        'Your saved copy was deleted. This phone keeps its results.',
      );
      expect(screen.getByTestId('sync-email')).toBeOnTheScreen();
    });

    it('THEN a failure stays on the confirm screen and says why in the house’s words', async () => {
      const { raw } = await signedIn({ fail: 'TypeError: Network request failed' });
      await act(async () =>
        fireEvent.press(screen.getByRole('button', { name: 'Delete my data' })),
      );
      await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Delete' })));
      await flush();
      expect(screen.getByTestId('delete-error')).toBeOnTheScreen();
      expect(screen.queryByText(/TypeError/)).toBeNull();
      expect(raw.auth.signOut).not.toHaveBeenCalled();
    });
  });

  describe('WHEN they tap “Request account deletion” (G2)', () => {
    it('THEN an email to the privacy page’s contact opens, asking for the account to go, with their email', async () => {
      const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
      await signedIn();
      await act(async () =>
        fireEvent.press(screen.getByRole('button', { name: 'Delete my data' })),
      );
      await act(async () =>
        fireEvent.press(screen.getByRole('button', { name: 'Request account deletion' })),
      );
      const url = open.mock.calls[0]![0];
      expect(url).toBe(deletionRequestUrl('alec@example.com'));
      expect(url.startsWith(`mailto:${CONTACT_EMAIL}?subject=`)).toBe(true);
      expect(CONTACT_EMAIL).toBe('contact@dailynoodle.co.uk');
      expect(decodeURIComponent(url)).toMatch(/Delete my Daily Noodle account/);
      expect(decodeURIComponent(url)).toMatch(/Sign-in email: alec@example\.com/);
      expect(screen.queryByTestId('account-mail-failed')).toBeNull();
    });

    it('THEN with no email app, it says where to write instead', async () => {
      jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));
      await signedIn();
      await act(async () =>
        fireEvent.press(screen.getByRole('button', { name: 'Delete my data' })),
      );
      await act(async () =>
        fireEvent.press(screen.getByRole('button', { name: 'Request account deletion' })),
      );
      await flush();
      expect(screen.getByTestId('account-mail-failed')).toHaveTextContent(CONTACT_EMAIL, {
        exact: false,
      });
    });
  });

  it('THEN signed out, the request email asks them to give their address', () => {
    expect(decodeURIComponent(deletionRequestUrl(null))).toMatch(
      /Sign-in email: \(the address I sign in with\)/,
    );
  });
});
