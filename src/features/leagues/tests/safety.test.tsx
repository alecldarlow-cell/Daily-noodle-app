/* League rules, Hide and Report (8 Nov 2026): Google Play's user-generated content policy. */
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { londonDay } from '@noodle/core';

import { appStorage } from '@/shared/storage';
import { renderWithProviders } from '@/shared/testing';

import * as api from '../api/board';
import { fetchPuzzleCards } from '../api/feed';
import { LeaguesScreen } from '../components/LeaguesScreen/LeaguesScreen';
import { reportUrl } from '../components/Board';
import { HIDE_KEY, readHidden, unhide, withHidden } from '../hooks/hidden';
import { clearStore, dayBoard, FAMILY, mineRow, overall, PID, setBoard } from './helpers';

jest.mock('../api/board');
jest.mock('../api/feed');
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
  useNavigation: () => ({ setParams: jest.fn() }),
}));
jest.setTimeout(30_000);

const m = jest.mocked(api);
const MEMBER = { ...FAMILY, owner: false };

beforeEach(() => {
  clearStore();
  jest.clearAllMocks();
  const today = londonDay();
  jest.mocked(fetchPuzzleCards).mockResolvedValue([
    {
      path: `reports/${today}-crossword-mini-0105.html`,
      type: 'mini',
      id: 'DP·MINI·0105',
      date: today,
      headline: 'Mini 105',
    },
  ] as never);
  m.boardMine.mockResolvedValue([]);
  m.boardDay.mockResolvedValue(dayBoard());
  m.boardOverall.mockResolvedValue(overall());
  m.boardBackfill.mockResolvedValue(0);
});
afterEach(async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 60));
  });
});

describe('GIVEN the hidden-players helpers', () => {
  it('THEN a doc reads safely, hides and shows by league, and unhide drops only others’ rows', () => {
    expect(readHidden(null)).toEqual({});
    expect(readHidden('not json')).toEqual({});
    expect(readHidden('[1]')).toEqual({});
    expect(readHidden('{"A":["x",2],"B":"y"}')).toEqual({ A: ['x'] });
    const on = withHidden({}, 'A', 'Ma', true);
    expect(on).toEqual({ A: ['Ma'] });
    expect(withHidden(on, 'A', 'Ma', false)).toEqual({});
    const d = {
      day: [
        { nick: 'Ma', me: false },
        { nick: 'Alec', me: true },
      ],
      players: ['Alec', 'Ma'],
      n: 2,
    };
    expect(unhide(d, ['Ma', 'Alec'])).toEqual({
      day: [{ nick: 'Alec', me: true }],
      players: ['Alec', 'Ma'],
      n: 2,
    });
    expect(unhide(d, [])).toBe(d);
    expect(unhide(undefined, ['Ma'])).toBeUndefined();
  });

  it('THEN Report’s email names the league and the player', () => {
    const u = decodeURIComponent(reportUrl(MEMBER, 'Ma'));
    expect(u.startsWith('mailto:contact@dailynoodle.co.uk?subject=Report a name in Family')).toBe(
      true,
    );
    expect(u).toContain('League: Family (code ABCD2345)');
    expect(u).toContain('Name I’m reporting: Ma');
    expect(decodeURIComponent(reportUrl(MEMBER, ''))).toContain('What I’m reporting:');
  });
});

describe('GIVEN someone starting a league', () => {
  it('WHEN they haven’t ticked the league rules THEN nothing is sent; ticked, the league starts', async () => {
    m.boardCreate.mockResolvedValue({
      code: 'NEWC2345',
      name: 'Fam',
      nick: 'Al',
      owner: true,
      members: 1,
      pin: false,
    } as never);
    await renderWithProviders(<LeaguesScreen />);
    const start = await screen.findByRole('button', { name: 'Start a league' });
    await fireEvent.press(start);
    await fireEvent.changeText(screen.getByLabelText('League name'), 'Fam');
    await fireEvent.changeText(screen.getByLabelText('Your nickname'), 'Al');
    await fireEvent.press(screen.getByRole('button', { name: 'Start league' }));
    expect(screen.getByText('Tick the box to agree to the league rules.')).toBeOnTheScreen();
    expect(m.boardCreate).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('rules-tick'));
    await fireEvent.press(screen.getByRole('button', { name: 'Start league' }));
    await waitFor(() => expect(m.boardCreate).toHaveBeenCalled());
  });

  it('THEN League rules opens the rules on the website', async () => {
    await renderWithProviders(<LeaguesScreen />);
    const start = await screen.findByRole('button', { name: 'Start a league' });
    await fireEvent.press(start);
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await fireEvent.press(screen.getByTestId('rules-link'));
    expect(open).toHaveBeenCalledWith('https://dailynoodle.co.uk/privacy.html#league-rules');
    open.mockRestore();
  });
});

describe('GIVEN a member (not the owner) in Family with Ma', () => {
  async function openSettings() {
    setBoard({ pid: PID, leagues: [MEMBER], cur: MEMBER.code, fill: { n: 0, aids: [] } });
    m.boardMine.mockResolvedValue([mineRow(MEMBER)]);
    await renderWithProviders(<LeaguesScreen />);
    await waitFor(() => expect(screen.getByTestId('overall-board')).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId('league-picker'));
    await fireEvent.press(screen.getByTestId('menu-settings'));
  }

  it('WHEN they hide Ma THEN her rows leave this phone’s boards, and Show brings them back', async () => {
    await openSettings();
    expect(screen.getAllByTestId('row-Ma').length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByTestId('hide-Ma'));
    await waitFor(() => expect(screen.queryAllByTestId('row-Ma')).toHaveLength(0));
    expect(screen.getByText('Ma (hidden)')).toBeOnTheScreen();
    expect(JSON.parse(appStorage.getItem(HIDE_KEY)!)).toEqual({ ABCD2345: ['Ma'] });
    expect(screen.getByTestId('row-Alec')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('hide-Ma'));
    await waitFor(() => expect(screen.getAllByTestId('row-Ma').length).toBeGreaterThan(0));
  });

  it('WHEN they tap Report THEN an email to us opens naming the league and Ma', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await openSettings();
    await fireEvent.press(screen.getByTestId('report-Ma'));
    expect(open).toHaveBeenCalledWith(reportUrl(MEMBER, 'Ma'));
    await fireEvent.press(screen.getByTestId('report-league'));
    expect(open).toHaveBeenLastCalledWith(reportUrl(MEMBER, ''));
    open.mockRestore();
  });
});
