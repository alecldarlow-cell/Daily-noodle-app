import { londonDay } from '@noodle/core';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Share, StyleSheet } from 'react-native';

import { QueryProvider } from '@/shared/query';
import { BUILD_ENV } from '@/shared/env';
import { tokensFor } from '@/shared/theme';
import { appStorage } from '@/shared/storage';
import { renderWithProviders } from '@/shared/testing';

import * as api from '../api/board';
import { BoardError } from '../api/errors';
import { fetchPuzzleCards } from '../api/feed';
import { LeaguesScreen } from '../components/LeaguesScreen/LeaguesScreen';
import { addDays } from '../hooks/boardText';
import {
  board,
  clearStore,
  dayBoard,
  FAMILY,
  mineRow,
  OTHER,
  overall,
  PID,
  setBoard,
} from './helpers';

jest.mock('../api/board');
jest.mock('../api/feed');
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
  useNavigation: () => mockNavigation,
}));
// The tab's own navigation: Leagues clears the route's ask once it has read it.
const mockNavigation = { setParams: jest.fn() };

const m = jest.mocked(api);
const env = BUILD_ENV as Record<string, string | undefined>;
const SYNC = env.EXPO_PUBLIC_SYNC;
const params = jest.mocked(useLocalSearchParams);
const today = londonDay();
const MINI_PATH = `reports/${today}-crossword-mini-0105.html`;

let shared: string[] = [];

// The first render loads the whole feature; give a busy machine room.
jest.setTimeout(30_000);

beforeEach(() => {
  clearStore();
  jest.clearAllMocks();
  params.mockReturnValue({});
  shared = [];
  jest.spyOn(Share, 'share').mockImplementation(async (c) => {
    shared.push((c as { message: string }).message);
    return { action: 'sharedAction', activityType: undefined };
  });
  // Confirm every dialog.
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.[1]?.onPress?.());
  jest
    .mocked(fetchPuzzleCards)
    .mockResolvedValue([
      { path: MINI_PATH, type: 'mini', id: 'DP·MINI·0105', date: today, headline: 'Mini 105' },
    ]);
  m.boardMine.mockResolvedValue([]);
  m.boardDay.mockResolvedValue(dayBoard());
  m.boardOverall.mockResolvedValue(overall());
  m.boardBackfill.mockResolvedValue(0);
  m.boardPinSet.mockResolvedValue(true);
});

afterEach(async () => {
  env.EXPO_PUBLIC_SYNC = SYNC;
  await act(async () => {
    await new Promise((r) => setTimeout(r, 60));
  });
});

const type = (label: string, text: string) =>
  fireEvent.changeText(screen.getByLabelText(label), text);
const press = (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }));

/** A player in Family, with that league's boards answering. */
function inFamily(extra: Record<string, unknown> = {}) {
  setBoard({ pid: PID, leagues: [FAMILY], cur: FAMILY.code, fill: { n: 0, aids: [] }, ...extra });
  m.boardMine.mockResolvedValue([mineRow()]);
}

describe('GIVEN someone in no league', () => {
  describe('WHEN Leagues opens', () => {
    it('THEN it invites them to start a league or join one with a code', async () => {
      await renderWithProviders(<LeaguesScreen />);
      expect(
        screen.getByRole('header', { name: 'Daily leaderboards for your group' }),
      ).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Start a league' })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Join with a code' })).toBeOnTheScreen();
      // Someone already in a league joins with its code too, then picks their name.
      expect(screen.queryByText(/Already in a league/)).toBeNull();
      // No board id yet, so nothing to ask the server.
      expect(m.boardMine).not.toHaveBeenCalled();
    });
  });

  describe('WHEN they start a league with a PIN', () => {
    it('THEN the league is made under a new board id, the PIN set, and its invite offered', async () => {
      m.boardCreate.mockResolvedValue({ code: 'NEWC2345', name: 'Noodle family' });
      m.boardMine.mockResolvedValue([
        mineRow({ ...FAMILY, code: 'NEWC2345', name: 'Noodle family', pin: false }),
      ]);
      await renderWithProviders(<LeaguesScreen />);
      await press('Start a league');
      await type('League name', '  Noodle   family ');
      await type('Your nickname', 'Alec');
      await type('PIN', '1234');
      await press('Start league');
      await waitFor(() => expect(screen.getByTestId('notice-created')).toBeOnTheScreen());
      const pid = board().pid!;
      expect(pid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(m.boardCreate).toHaveBeenCalledWith(pid, 'Noodle family', 'Alec');
      expect(m.boardPinSet).toHaveBeenCalledWith(pid, '1234');
      expect(board()).toMatchObject({
        cur: 'NEWC2345',
        leagues: [{ code: 'NEWC2345', nick: 'Alec', owner: true }],
      });
      await fireEvent.press(
        within(screen.getByTestId('notice-created')).getByRole('button', { name: 'Invite people' }),
      );
      expect(shared).toEqual([
        'Join Noodle family on Noodle Puzzles: tap the link, pick a nickname, and your results go on our daily leaderboards.\nhttps://dailynoodle.co.uk/join.html?c=NEWC2345',
      ]);
    });

    it('THEN a nickname the server would refuse is caught first, in the site’s words', async () => {
      await renderWithProviders(<LeaguesScreen />);
      await press('Start a league');
      await type('League name', 'Family');
      await type('Your nickname', 'A');
      await press('Start league');
      expect(screen.getByText('Nicknames are 2–16 letters or numbers.')).toBeOnTheScreen();
      expect(m.boardCreate).not.toHaveBeenCalled();
    });

    it('THEN a refusal from the server shows its reason', async () => {
      m.boardCreate.mockRejectedValue(new BoardError('too_many_owned'));
      await renderWithProviders(<LeaguesScreen />);
      await press('Start a league');
      await type('League name', 'Family');
      await type('Your nickname', 'Alec');
      await press('Start league');
      await waitFor(() =>
        expect(screen.getByText('You can run up to 3 leagues.')).toBeOnTheScreen(),
      );
    });
  });

  describe('WHEN they join with an invite link pasted as the code', () => {
    it('THEN the league’s invite opens, as the link would, and they join from it', async () => {
      m.boardPeek.mockResolvedValue({ name: 'Family', members: 3, players: ['Ma', 'Jo', 'Bo'] });
      m.boardJoin.mockResolvedValue({ code: FAMILY.code, name: 'Family' });
      m.boardMine.mockResolvedValue([mineRow({ ...FAMILY, owner: false })]);
      await renderWithProviders(<LeaguesScreen />);
      await press('Join with a code');
      await type('League code', 'https://dailynoodle.co.uk/join.html?c=abcd2345');
      await press('Next');
      await waitFor(() =>
        expect(screen.getByRole('header', { name: 'Join Family' })).toBeOnTheScreen(),
      );
      expect(m.boardPeek).toHaveBeenCalledWith('ABCD2345');
      expect(
        screen.getByRole('button', { name: 'Already in Family? Pick your name' }),
      ).toBeOnTheScreen();
      await type('Your nickname', 'Alec');
      await press('Join league');
      await waitFor(() =>
        expect(screen.getByRole('header', { name: 'You’re in Family' })).toBeOnTheScreen(),
      );
      expect(m.boardJoin).toHaveBeenCalledWith(board().pid, 'ABCD2345', 'Alec');
      expect(m.boardPinSet).not.toHaveBeenCalled();
    });

    it('THEN a code that isn’t one is caught before anything is asked', async () => {
      await renderWithProviders(<LeaguesScreen />);
      await press('Join with a code');
      await type('League code', 'AB');
      await press('Next');
      expect(
        screen.getByText('Enter the league’s code, or paste its invite link.'),
      ).toBeOnTheScreen();
      expect(m.boardPeek).not.toHaveBeenCalled();
    });
  });

  describe('WHEN the code they type belongs to no league', () => {
    it('THEN it says so, and Try again goes back to the code', async () => {
      m.boardPeek.mockRejectedValue(new BoardError('no_league'));
      await renderWithProviders(<LeaguesScreen />);
      await press('Join with a code');
      await type('League code', 'WXYZ2345');
      await press('Next');
      await waitFor(() =>
        expect(screen.getByRole('header', { name: 'No league has that code' })).toBeOnTheScreen(),
      );
      await press('Try again');
      expect(screen.getByRole('header', { name: 'Join a league' })).toBeOnTheScreen();
    });
  });

  describe('WHEN they join while sign-in is in the build', () => {
    it('THEN the board offers signing in, for playing on another phone too', async () => {
      env.EXPO_PUBLIC_SYNC = '1';
      params.mockReturnValue({ join: 'abcd2345' });
      m.boardPeek.mockResolvedValue({ name: 'Family', members: 3, players: ['Ma', 'Jo', 'Bo'] });
      m.boardJoin.mockResolvedValue({ code: FAMILY.code, name: 'Family' });
      m.boardMine.mockResolvedValue([mineRow({ ...FAMILY, owner: false })]);
      await renderWithProviders(<LeaguesScreen />);
      await waitFor(() =>
        expect(screen.getByRole('header', { name: 'Join Family' })).toBeOnTheScreen(),
      );
      await type('Your nickname', 'Alec');
      await press('Join league');
      await waitFor(() =>
        expect(screen.getByRole('header', { name: 'You’re in Family' })).toBeOnTheScreen(),
      );
      await press('Sign in on Account');
      expect(router.navigate).toHaveBeenCalledWith('/account');
      expect(screen.queryByTestId('notice-joined')).toBeNull();
    });

    it('THEN without sign-in in the build, the card doesn’t mention it', async () => {
      env.EXPO_PUBLIC_SYNC = undefined;
      params.mockReturnValue({ join: 'abcd2345' });
      m.boardPeek.mockResolvedValue({ name: 'Family', members: 3, players: ['Ma', 'Jo', 'Bo'] });
      m.boardJoin.mockResolvedValue({ code: FAMILY.code, name: 'Family' });
      m.boardMine.mockResolvedValue([mineRow({ ...FAMILY, owner: false })]);
      await renderWithProviders(<LeaguesScreen />);
      await waitFor(() =>
        expect(screen.getByRole('header', { name: 'Join Family' })).toBeOnTheScreen(),
      );
      await type('Your nickname', 'Alec');
      await press('Join league');
      await waitFor(() =>
        expect(screen.getByRole('header', { name: 'You’re in Family' })).toBeOnTheScreen(),
      );
      expect(screen.queryByRole('button', { name: 'Sign in on Account' })).toBeNull();
    });
  });
});

describe('GIVEN an invite link opened in the app (?join=)', () => {
  beforeEach(() => {
    params.mockReturnValue({ join: 'abcd2345' });
    m.boardPeek.mockResolvedValue({ name: 'Family', members: 3, players: ['Alec', 'Ma', 'Jo'] });
  });

  describe('WHEN the nickname is taken', () => {
    it('THEN the message points to “Already in Family?”', async () => {
      m.boardJoin.mockRejectedValue(new BoardError('nick_taken'));
      await renderWithProviders(<LeaguesScreen />);
      await waitFor(() =>
        expect(screen.getByRole('header', { name: 'Join Family' })).toBeOnTheScreen(),
      );
      expect(screen.getByText(/3 players so far/)).toBeOnTheScreen();
      await type('Your nickname', 'Alec');
      await press('Join league');
      await waitFor(() =>
        expect(
          screen.getByText(
            'Someone in that league already uses that nickname. If that’s you, tap “Already in Family?” below.',
          ),
        ).toBeOnTheScreen(),
      );
    });
  });

  describe('WHEN an existing player picks their name and enters their PIN', () => {
    it('THEN this install becomes that player and the board shows their history', async () => {
      m.boardClaim.mockResolvedValue({
        ok: true,
        player: OTHER,
        code: 'ABCD2345',
        name: 'Family',
        nick: 'Ma',
        needs_pin: false,
      });
      m.boardMine.mockResolvedValue([mineRow({ ...FAMILY, nick: 'Ma', owner: false })]);
      await renderWithProviders(<LeaguesScreen />);
      await waitFor(() =>
        expect(screen.getByRole('header', { name: 'Join Family' })).toBeOnTheScreen(),
      );
      await press('Already in Family? Pick your name');
      expect(screen.getByRole('header', { name: 'Already in Family?' })).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('radio', { name: 'Ma' }));
      await type('Your PIN', '4321');
      await press('Play as me here');
      await waitFor(() =>
        expect(
          screen.getByRole('header', { name: 'You’re playing as Ma here too' }),
        ).toBeOnTheScreen(),
      );
      expect(m.boardClaim).toHaveBeenCalledWith('ABCD2345', 'Ma', '4321');
      expect(board()).toMatchObject({
        pid: OTHER,
        cur: 'ABCD2345',
        leagues: [{ code: 'ABCD2345', nick: 'Ma' }],
      });
      await waitFor(() => expect(m.boardOverall).toHaveBeenCalledWith(OTHER, 'ABCD2345', today));
    });

    it('THEN a wrong PIN says so, and nothing changes', async () => {
      m.boardClaim.mockResolvedValue({ ok: false, error: 'bad_pin' });
      await renderWithProviders(<LeaguesScreen />);
      await waitFor(() =>
        expect(screen.getByRole('header', { name: 'Join Family' })).toBeOnTheScreen(),
      );
      await press('Already in Family? Pick your name');
      await fireEvent.press(screen.getByRole('radio', { name: 'Ma' }));
      await type('Your PIN', '0000');
      await press('Play as me here');
      await waitFor(() =>
        expect(
          screen.getByText('That PIN doesn’t match. Check the nickname and try again.'),
        ).toBeOnTheScreen(),
      );
      expect(board().pid).toBeUndefined();
      await press('Back');
      expect(screen.getByRole('header', { name: 'Join Family' })).toBeOnTheScreen();
    });

    it('THEN a player let back in without a PIN is asked to set a new one', async () => {
      m.boardClaim.mockResolvedValue({
        ok: true,
        player: OTHER,
        code: 'ABCD2345',
        name: 'Family',
        nick: 'Ma',
        needs_pin: true,
      });
      m.boardMine.mockResolvedValue([mineRow({ ...FAMILY, nick: 'Ma', owner: false, pin: false })]);
      await renderWithProviders(<LeaguesScreen />);
      await waitFor(() =>
        expect(screen.getByRole('header', { name: 'Join Family' })).toBeOnTheScreen(),
      );
      await press('Already in Family? Pick your name');
      await fireEvent.press(screen.getByRole('radio', { name: 'Ma' }));
      await press('Play as me here');
      await waitFor(() =>
        expect(screen.getByRole('header', { name: 'Set a new PIN' })).toBeOnTheScreen(),
      );
      await type('PIN', '12');
      await press('Save PIN');
      expect(screen.getByText('PINs are 4 numbers.')).toBeOnTheScreen();
      await type('PIN', '2468');
      await press('Save PIN');
      await waitFor(() =>
        expect(screen.getByRole('header', { name: 'PIN saved' })).toBeOnTheScreen(),
      );
      expect(m.boardPinSet).toHaveBeenCalledWith(OTHER, '2468');
    });
  });

  describe('WHEN this install already plays in a league as someone else', () => {
    it('THEN it asks which leagues to use, and “Use those leagues” switches player', async () => {
      inFamily();
      setBoard({
        pid: PID,
        leagues: [{ ...FAMILY, code: 'WORK2345', name: 'Work' }],
        cur: 'WORK2345',
      });
      m.boardMine.mockResolvedValue([mineRow({ ...FAMILY, code: 'WORK2345', name: 'Work' })]);
      m.boardClaim.mockResolvedValue({
        ok: true,
        player: OTHER,
        code: 'ABCD2345',
        name: 'Family',
        nick: 'Ma',
        needs_pin: false,
      });
      await renderWithProviders(<LeaguesScreen />);
      await waitFor(() =>
        expect(screen.getByRole('header', { name: 'Join Family' })).toBeOnTheScreen(),
      );
      await press('Already in Family? Pick your name');
      await fireEvent.press(screen.getByRole('radio', { name: 'Ma' }));
      await type('Your PIN', '4321');
      await press('Play as me here');
      await waitFor(() =>
        expect(
          screen.getByRole('header', { name: 'Which leagues should this app use?' }),
        ).toBeOnTheScreen(),
      );
      expect(screen.getByText('Here you play in Work as Alec.')).toBeOnTheScreen();
      expect(screen.getByText('Your other player is in Family as Ma.')).toBeOnTheScreen();
      expect(board().pid).toBe(PID);
      m.boardMine.mockResolvedValue([mineRow({ ...FAMILY, nick: 'Ma', owner: false })]);
      await press('Use those leagues');
      await waitFor(() => expect(board().pid).toBe(OTHER));
      await waitFor(() =>
        expect(screen.getByRole('header', { name: 'Your leagues are here now' })).toBeOnTheScreen(),
      );
    });
  });

  describe('WHEN the invite can’t be fetched (no signal)', () => {
    it('THEN it says so, not “expired”, and Try again fetches it', async () => {
      m.boardPeek.mockRejectedValueOnce(new BoardError('offline'));
      await renderWithProviders(<LeaguesScreen />);
      await waitFor(() =>
        expect(
          screen.getByRole('header', { name: 'Couldn’t reach the leagues' }),
        ).toBeOnTheScreen(),
      );
      expect(screen.queryByText('That link has expired')).toBeNull();
      await press('Try again');
      await waitFor(() =>
        expect(screen.getByRole('header', { name: 'Join Family' })).toBeOnTheScreen(),
      );
    });
  });

  describe('WHEN someone in no league would rather not join', () => {
    it('THEN Back takes them to the intro', async () => {
      await renderWithProviders(<LeaguesScreen />);
      await waitFor(() =>
        expect(screen.getByRole('header', { name: 'Join Family' })).toBeOnTheScreen(),
      );
      await press('Back');
      expect(
        screen.getByRole('header', { name: 'Daily leaderboards for your group' }),
      ).toBeOnTheScreen();
    });
  });

  describe('WHEN the code no longer works', () => {
    it('THEN it says the link has expired', async () => {
      m.boardPeek.mockRejectedValue(new BoardError('no_league'));
      await renderWithProviders(<LeaguesScreen />);
      await waitFor(() =>
        expect(screen.getByRole('header', { name: 'That link has expired' })).toBeOnTheScreen(),
      );
      await press('OK');
      expect(
        screen.getByRole('header', { name: 'Daily leaderboards for your group' }),
      ).toBeOnTheScreen();
    });
  });

  describe('WHEN it’s a league this install is already in', () => {
    it('THEN its board just opens', async () => {
      inFamily({ cur: '' });
      await renderWithProviders(<LeaguesScreen />);
      await waitFor(() => expect(screen.getByTestId('overall-board')).toBeOnTheScreen());
      expect(m.boardPeek).not.toHaveBeenCalled();
      expect(board().cur).toBe('ABCD2345');
    });
  });
});

describe('GIVEN a player in a league', () => {
  describe('WHEN Leagues opens', () => {
    it('THEN All puzzles shows the day and the week, in points', async () => {
      inFamily();
      await renderWithProviders(<LeaguesScreen />);
      await waitFor(() => expect(screen.getByTestId('overall-board')).toBeOnTheScreen());
      expect(m.boardMine).toHaveBeenCalledWith(PID);
      expect(m.boardOverall).toHaveBeenCalledWith(PID, 'ABCD2345', today);
      expect(screen.getByLabelText('🥇 Ma, 9 pts, 4 of 8 done')).toBeOnTheScreen();
      expect(screen.getByLabelText('🥈 Alec (you), 1 pt, 1 of 8 done')).toBeOnTheScreen();
      expect(screen.getByText(/This week · 19 Oct – 25 Oct/)).toBeOnTheScreen();
      await press('Share leaderboard');
      expect(shared[0]).toMatch(
        /^🏆 All puzzles · .*\n🥇 Ma 9 pts \(4\/8\)\n🥈 Alec 1 pt \(1\/8\)\nFamily leaderboard:\n.*join=ABCD2345&v=2&p=all/,
      );
    });

    it('THEN a puzzle’s pill shows its board, remembered for next time, and the day bar steps back', async () => {
      inFamily();
      await renderWithProviders(<LeaguesScreen />);
      await waitFor(() => expect(screen.getByTestId('overall-board')).toBeOnTheScreen());
      await fireEvent.press(screen.getByTestId('pill-mini'));
      await waitFor(() => expect(screen.getByTestId('day-board')).toBeOnTheScreen());
      expect(board().ptype).toBe('mini');
      expect(m.boardDay).toHaveBeenCalledWith(PID, 'ABCD2345', 'mini', today);
      expect(screen.getByText(/Mini 105/)).toBeOnTheScreen();
      expect(screen.getByLabelText('🥇 Ma, 1:01')).toBeOnTheScreen();
      expect(screen.getByLabelText('🥈 Alec (you), 1:27')).toBeOnTheScreen();
      expect(screen.getByLabelText('– Jo, Revealed')).toBeOnTheScreen();
      expect(screen.getByText('🔥 3-day streak')).toBeOnTheScreen();
      expect(screen.getByText('Piers')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Next day' })).toBeDisabled();
      await press('Previous day');
      await waitFor(() =>
        expect(m.boardDay).toHaveBeenCalledWith(PID, 'ABCD2345', 'mini', addDays(today, -1)),
      );
      await waitFor(() => expect(screen.getByText('Yesterday')).toBeOnTheScreen());
      expect(screen.getByRole('button', { name: 'Next day' })).toBeEnabled();
    });

    it('THEN a puzzle they haven’t played offers to open it, and an empty board says nobody has', async () => {
      inFamily({ ptype: 'mini' });
      m.boardDay.mockResolvedValue(dayBoard({ ranked: [], unranked: [] }));
      await renderWithProviders(<LeaguesScreen />);
      await waitFor(() =>
        expect(screen.getByText('Nobody in Family has played Mini yet today.')).toBeOnTheScreen(),
      );
      await press(/Play Mini 105/);
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/play/[type]/[file]',
        params: { type: 'mini', file: `${today}-crossword-mini-0105` },
      });
    });

    it('THEN puzzles finished here before are copied to the board once', async () => {
      inFamily();
      appStorage.setItem(
        'digi-mini-v1',
        JSON.stringify({ v: 1, done: { 'DP·MINI·0105': { s: 87, d: today } } }),
      );
      m.boardBackfill.mockResolvedValue(1);
      await renderWithProviders(<LeaguesScreen />);
      await waitFor(() => expect(screen.getByTestId('overall-board')).toBeOnTheScreen());
      expect(m.boardBackfill).toHaveBeenCalledTimes(1);
      expect(m.boardBackfill).toHaveBeenCalledWith(PID, null, [
        { outcome: 'solved', secs: 87, path: MINI_PATH },
      ]);
      expect(board().fill).toEqual({ n: 1, aids: [] });
    });

    it('THEN a board they’re no longer on sends them back to the server’s list', async () => {
      inFamily();
      m.boardOverall.mockRejectedValue(new BoardError('not_member'));
      m.boardMine.mockResolvedValue([]);
      await renderWithProviders(<LeaguesScreen />);
      await waitFor(() =>
        expect(
          screen.getByRole('header', { name: 'Daily leaderboards for your group' }),
        ).toBeOnTheScreen(),
      );
      expect(board().leagues).toEqual([]);
    });

    it('THEN without a PIN they are nudged to set one, until Later', async () => {
      inFamily({ leagues: [{ ...FAMILY, pin: false }] });
      m.boardMine.mockResolvedValue([mineRow({ ...FAMILY, pin: false })]);
      await renderWithProviders(<LeaguesScreen />);
      await waitFor(() => expect(screen.getByTestId('pin-nudge')).toBeOnTheScreen());
      await press('Later');
      expect(screen.queryByTestId('pin-nudge')).toBeNull();
      expect(appStorage.getItem('noodle-board-pinlater')).toBe(today);
    });
  });

  describe('WHEN they open League settings', () => {
    async function openSettings() {
      inFamily();
      await renderWithProviders(<LeaguesScreen />);
      await waitFor(() => expect(screen.getByTestId('overall-board')).toBeOnTheScreen());
      await press('⚙︎ League settings');
    }

    it('THEN the owner can rename, let a player back in, remove, renew the code and close', async () => {
      await openSettings();
      expect(screen.getByText(/Code/)).toHaveTextContent('Code ABCD2345 · 2 players');
      m.boardRename.mockResolvedValue(true);
      await type('League name', 'The   Noodles');
      await press('Save');
      await waitFor(() =>
        expect(m.boardRename).toHaveBeenCalledWith(PID, 'ABCD2345', 'The Noodles'),
      );
      m.boardLetBack.mockResolvedValue(true);
      await press('Let Ma back in');
      await waitFor(() =>
        expect(
          screen.getByText(/Ma can join from another phone or app without a PIN/),
        ).toBeOnTheScreen(),
      );
      m.boardRemove.mockResolvedValue(true);
      await press('Remove Ma');
      await waitFor(() => expect(m.boardRemove).toHaveBeenCalledWith(PID, 'ABCD2345', 'Ma'));
      m.boardNewCode.mockResolvedValue({ code: 'NEWC2345' });
      await press('New join code');
      await waitFor(() => expect(m.boardNewCode).toHaveBeenCalledWith(PID, 'ABCD2345'));
      await waitFor(() => expect(board().cur).toBe('NEWC2345'));
    });

    it('THEN closing the league asks first, then takes it away', async () => {
      await openSettings();
      m.boardClose.mockResolvedValue(true);
      m.boardMine.mockResolvedValue([]);
      await press('Close league');
      expect(Alert.alert).toHaveBeenCalledWith(
        'Close league',
        'Close Family for everyone? It comes off all its players’ boards.',
        expect.anything(),
      );
      await waitFor(() => expect(m.boardClose).toHaveBeenCalledWith(PID, 'ABCD2345'));
      await waitFor(() =>
        expect(
          screen.getByRole('header', { name: 'Daily leaderboards for your group' }),
        ).toBeOnTheScreen(),
      );
    });

    it('THEN leaving asks first, and a failure says why', async () => {
      await openSettings();
      m.boardLeave.mockRejectedValue(new BoardError('not_member'));
      await press('Leave league');
      expect(Alert.alert).toHaveBeenCalledWith(
        'Leave league',
        'Leave Family? You’ll come off its boards. You can rejoin with the link.',
        expect.anything(),
      );
      await waitFor(() => expect(screen.getByText('You’re not in that league.')).toBeOnTheScreen());
    });

    it('THEN “Play somewhere else too?” points to the PIN and sign-in, not a personal link', async () => {
      env.EXPO_PUBLIC_SYNC = '1';
      await openSettings();
      expect(screen.getByText(/pick your nickname and enter your PIN/)).toBeOnTheScreen();
      expect(screen.getByText(/sign in on Account with your email/)).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Send me my link' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Paste a link' })).toBeNull();
    });

    it('THEN a bad league name is caught before it’s sent', async () => {
      await openSettings();
      await type('League name', 'x');
      await press('Save');
      expect(screen.getByText('League names are 2–30 letters or numbers.')).toBeOnTheScreen();
      expect(m.boardRename).not.toHaveBeenCalled();
    });
  });
});

describe('GIVEN a claim that brings another player to an install already in a league', () => {
  describe('WHEN they choose to keep this one', () => {
    it('THEN this install keeps its player and the choice goes', async () => {
      inFamily();
      params.mockReturnValue({ go: 'claim' });
      m.boardClaim.mockResolvedValue({
        ok: true,
        player: OTHER,
        code: 'WORK2345',
        name: 'Work',
        nick: 'Ma',
        needs_pin: false,
      });
      await renderWithProviders(<LeaguesScreen />);
      await type('League code', 'WORK2345');
      await type('Your nickname', 'Ma');
      await type('Your PIN', '4321');
      await press('Play as me here');
      await waitFor(() =>
        expect(
          screen.getByRole('header', { name: 'Which leagues should this app use?' }),
        ).toBeOnTheScreen(),
      );
      await press('Keep this one');
      await waitFor(() => expect(screen.getByTestId('overall-board')).toBeOnTheScreen());
      expect(board().pid).toBe(PID);
      expect(board().pend).toBeUndefined();
    });
  });
});

describe('GIVEN shortcuts into Leagues', () => {
  it('THEN ?go= opens the claim, start and join forms', async () => {
    params.mockReturnValue({ go: 'claim' });
    const r = await renderWithProviders(<LeaguesScreen />);
    expect(screen.getByRole('header', { name: 'Already in a league?' })).toBeOnTheScreen();
    expect(screen.queryByText('Have a personal link instead?')).toBeNull();
    params.mockReturnValue({ go: 'start' });
    const again = () =>
      r.rerender(
        <QueryProvider client={r.client}>
          <LeaguesScreen />
        </QueryProvider>,
      );
    await again();
    expect(screen.getByRole('header', { name: 'Start a league' })).toBeOnTheScreen();
    params.mockReturnValue({ go: 'code' });
    await again();
    expect(screen.getByRole('header', { name: 'Join a league' })).toBeOnTheScreen();
    await press('Back');
    expect(
      screen.getByRole('header', { name: 'Daily leaderboards for your group' }),
    ).toBeOnTheScreen();
  });

  it('THEN the old personal-link shortcut (?go=paste) just opens Leagues', async () => {
    params.mockReturnValue({ go: 'paste' });
    await renderWithProviders(<LeaguesScreen />);
    expect(
      screen.getByRole('header', { name: 'Daily leaderboards for your group' }),
    ).toBeOnTheScreen();
  });

  it('THEN a claim by code (no invite) sends the code typed', async () => {
    params.mockReturnValue({ go: 'claim' });
    m.boardClaim.mockResolvedValue({ ok: false, error: 'no_player' });
    await renderWithProviders(<LeaguesScreen />);
    await type('League code', 'abcd2345');
    await type('Your nickname', 'Zed');
    await press('Play as me here');
    await waitFor(() =>
      expect(screen.getByText('Nobody in that league has that nickname.')).toBeOnTheScreen(),
    );
    expect(m.boardClaim).toHaveBeenCalledWith('ABCD2345', 'Zed', '');
  });
});

describe('GIVEN Leagues opened on a puzzle’s board (?p=&d=, as board.html)', () => {
  const earlier = addDays(today, -2);

  describe('WHEN the finish sheet’s link names a puzzle and its day', () => {
    it('THEN that puzzle’s board for that day shows, without changing the remembered pill', async () => {
      inFamily({ ptype: 'doku' });
      params.mockReturnValue({ p: 'mini', d: earlier });
      await renderWithProviders(<LeaguesScreen />);
      await waitFor(() => expect(screen.getByTestId('day-board')).toBeOnTheScreen());
      expect(m.boardDay).toHaveBeenCalledWith(PID, 'ABCD2345', 'mini', earlier);
      expect(m.boardDay).not.toHaveBeenCalledWith(PID, 'ABCD2345', 'doku', expect.anything());
      expect(screen.getByRole('button', { name: 'Mini' })).toBeSelected();
      expect(board().ptype).toBe('doku');
    });

    it('THEN a pill picked afterwards takes over, and is remembered', async () => {
      inFamily();
      params.mockReturnValue({ p: 'mini', d: earlier });
      await renderWithProviders(<LeaguesScreen />);
      await waitFor(() => expect(screen.getByTestId('day-board')).toBeOnTheScreen());
      await fireEvent.press(screen.getByTestId('pill-all'));
      await waitFor(() => expect(screen.getByTestId('overall-board')).toBeOnTheScreen());
      expect(m.boardOverall).toHaveBeenCalledWith(PID, 'ABCD2345', earlier);
      expect(board().ptype).toBe('all');
    });
  });

  describe('WHEN only a day is given, or p is all', () => {
    it('THEN the remembered pill shows on that day; all shows All puzzles', async () => {
      inFamily({ ptype: 'mini' });
      params.mockReturnValue({ d: earlier });
      const r = await renderWithProviders(<LeaguesScreen />);
      await waitFor(() =>
        expect(m.boardDay).toHaveBeenCalledWith(PID, 'ABCD2345', 'mini', earlier),
      );
      params.mockReturnValue({ p: 'all', d: earlier });
      await r.rerender(
        <QueryProvider client={r.client}>
          <LeaguesScreen />
        </QueryProvider>,
      );
      await waitFor(() => expect(screen.getByTestId('overall-board')).toBeOnTheScreen());
      expect(m.boardOverall).toHaveBeenCalledWith(PID, 'ABCD2345', earlier);
    });
  });

  describe('WHEN the values aren’t ones board.html would take', () => {
    it('THEN an unknown puzzle or a bad date falls back; a future day is today', async () => {
      inFamily({ ptype: 'mini' });
      params.mockReturnValue({ p: 'crossword', d: 'yesterday' });
      const r = await renderWithProviders(<LeaguesScreen />);
      await waitFor(() => expect(m.boardDay).toHaveBeenCalledWith(PID, 'ABCD2345', 'mini', today));
      params.mockReturnValue({ p: 'doku', d: addDays(today, 5) });
      await r.rerender(
        <QueryProvider client={r.client}>
          <LeaguesScreen />
        </QueryProvider>,
      );
      await waitFor(() => expect(m.boardDay).toHaveBeenCalledWith(PID, 'ABCD2345', 'doku', today));
      expect(m.boardDay).not.toHaveBeenCalledWith(
        PID,
        'ABCD2345',
        expect.anything(),
        addDays(today, 5),
      );
    });
  });

  describe('WHEN a form is showing and a board link arrives', () => {
    it('THEN the board opens on the asked puzzle and day', async () => {
      inFamily();
      params.mockReturnValue({ go: 'code' });
      const r = await renderWithProviders(<LeaguesScreen />);
      expect(screen.getByRole('header', { name: 'Join a league' })).toBeOnTheScreen();
      params.mockReturnValue({ p: 'path', d: earlier });
      await r.rerender(
        <QueryProvider client={r.client}>
          <LeaguesScreen />
        </QueryProvider>,
      );
      await waitFor(() => expect(screen.getByTestId('day-board')).toBeOnTheScreen());
      expect(m.boardDay).toHaveBeenCalledWith(PID, 'ABCD2345', 'path', earlier);
    });
  });
});

describe('GIVEN the button rule on Leagues (AF-019)', () => {
  describe('WHEN a player taps Share leaderboard and the share sheet takes a moment', () => {
    it('THEN the button shows a spinner and takes no second tap until the sheet is up', async () => {
      inFamily();
      let open: () => void = () => undefined;
      jest.mocked(Share.share).mockImplementation(
        (c) =>
          new Promise((r) => {
            open = () => {
              shared.push((c as { message: string }).message);
              r({ action: 'sharedAction', activityType: undefined });
            };
          }),
      );
      await renderWithProviders(<LeaguesScreen />);
      await waitFor(() => expect(screen.getByTestId('overall-board')).toBeOnTheScreen());
      const btn = screen.getByRole('button', { name: 'Share leaderboard' });
      await fireEvent.press(btn);
      expect(screen.getByTestId('button-spinner')).toBeOnTheScreen();
      expect(btn).toBeDisabled();
      await fireEvent.press(btn);
      expect(Share.share).toHaveBeenCalledTimes(1);
      await act(async () => open());
      expect(screen.queryByTestId('button-spinner')).toBeNull();
      expect(shared).toHaveLength(1);
    });
  });

  describe('WHEN the league settings show Leave league', () => {
    it('THEN it is a red tonal button, never the filled accent', async () => {
      inFamily();
      await renderWithProviders(<LeaguesScreen />);
      await waitFor(() => expect(screen.getByTestId('overall-board')).toBeOnTheScreen());
      await press('⚙︎ League settings');
      const t = tokensFor('light');
      const leave = StyleSheet.flatten(
        screen.getByRole('button', { name: 'Leave league' }).props.style,
      );
      expect(leave.backgroundColor).toBe(t.badSoft);
      expect(leave.minHeight).toBeGreaterThanOrEqual(48);
      expect(StyleSheet.flatten(screen.getByText('Leave league').props.style).color).toBe(t.bad);
    });
  });
});
