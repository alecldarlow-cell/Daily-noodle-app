import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { appStorage } from '@/shared/storage';
import { renderWithProviders } from '@/shared/testing';

import * as board from '../api/board';
import { BoardError } from '../api/errors';
import { LeaguesScreen } from '../components/LeaguesScreen/LeaguesScreen';

const mockParams: { current: Record<string, string> } = { current: {} };
jest.mock('@/shared/env', () => ({ BUILD_ENV: { EXPO_PUBLIC_SYNC: '1' } }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn() },
  useLocalSearchParams: () => mockParams.current,
  useNavigation: () => ({ setParams: jest.fn() }),
}));
jest.mock('../api/board');
jest.mock('../api/feed', () => ({ fetchPuzzleCards: async () => [] }));
const m = jest.mocked(board);

const FAMILY = {
  code: 'ABCDEFGH',
  name: 'Family',
  nick: 'Al',
  owner: true,
  members: 2,
  pin: false,
};
const inFamily = (league = FAMILY) =>
  appStorage.setItem(
    'noodle-board-v1',
    JSON.stringify({ pid: 'p1', leagues: [league], cur: 'ABCDEFGH' }),
  );
const mine = (pin = false) =>
  m.boardMine.mockResolvedValue([{ ...FAMILY, nickname: 'Al', pin }] as never);

beforeEach(() => {
  jest.clearAllMocks();
  mockParams.current = {};
  for (const k of ['noodle-board-v1', 'noodle-app-sync', 'noodle-board-pinlater'])
    appStorage.removeItem(k);
  m.boardDay.mockResolvedValue({
    ranked: [],
    unranked: [],
    not_yet: [],
    players: [],
    members: 1,
  } as never);
  m.boardOverall.mockResolvedValue({
    day: [],
    week: [],
    not_yet: [],
    players: [],
    members: 1,
  } as never);
  m.boardRecords.mockResolvedValue({
    records: {},
    players: [],
    crown: [],
    today: '2026-11-05',
  } as never);
});

describe('GIVEN a build with sign-in', () => {
  it('WHEN someone starts a league THEN no PIN is asked for', async () => {
    mockParams.current = { go: 'start' };
    await renderWithProviders(<LeaguesScreen />);
    await waitFor(() => expect(screen.getByTestId('start-form')).toBeOnTheScreen());
    expect(screen.queryByText('PIN')).toBeNull();
  });

  it('WHEN someone opens an invite THEN no PIN is asked for', async () => {
    m.boardPeek.mockResolvedValue({ name: 'Family', members: 2, players: ['Al'] } as never);
    mockParams.current = { join: 'ABCDEFGH' };
    await renderWithProviders(<LeaguesScreen />);
    await waitFor(() => expect(screen.getByTestId('invite-form')).toBeOnTheScreen());
    expect(screen.queryByText('PIN')).toBeNull();
  });

  it('WHEN a player has never signed in THEN they are asked to, not to set a PIN', async () => {
    inFamily();
    mine();
    await renderWithProviders(<LeaguesScreen />);
    await waitFor(() => expect(screen.getByTestId('signin-nudge')).toBeOnTheScreen());
    expect(screen.queryByTestId('pin-nudge')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Later' }));
    expect(screen.queryByTestId('signin-nudge')).toBeNull();
  });

  it('WHEN a player has synced, or has a PIN THEN no nudge shows', async () => {
    appStorage.setItem('noodle-app-sync', JSON.stringify({ at: 1 }));
    inFamily();
    mine();
    await renderWithProviders(<LeaguesScreen />);
    await waitFor(() => expect(m.boardMine).toHaveBeenCalled());
    expect(screen.queryByTestId('signin-nudge')).toBeNull();
  });
});

describe('GIVEN a league with a champion', () => {
  it('WHEN its board shows THEN the crown is explained, and not without one', async () => {
    inFamily({ ...FAMILY, pin: true });
    mine(true);
    m.boardRecords.mockResolvedValue({
      records: {},
      players: [],
      crown: ['Al'],
      today: '2026-11-05',
    } as never);
    await renderWithProviders(<LeaguesScreen />);
    await waitFor(() =>
      expect(screen.getByTestId('board-notes')).toHaveTextContent(/👑 last week’s champion/),
    );
  });
});

describe('GIVEN a player in a league', () => {
  it('WHEN they change their nickname THEN it goes to the server and the board follows', async () => {
    inFamily({ ...FAMILY, pin: true });
    mine(true);
    m.boardSetNick.mockResolvedValue('Alec' as never);
    const view = await renderWithProviders(<LeaguesScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: /League settings/ }));
    expect(screen.queryByRole('button', { name: /PIN/ })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Change nickname' }));
    await fireEvent.changeText(screen.getByLabelText('Nickname'), 'Alec');
    m.boardMine.mockResolvedValue([{ ...FAMILY, nickname: 'Alec', pin: true }] as never);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(m.boardSetNick).toHaveBeenCalledWith('p1', 'ABCDEFGH', 'Alec'));
    await waitFor(() => expect(screen.queryByTestId('nick-form')).toBeNull());
    expect(JSON.parse(appStorage.getItem('noodle-board-v1')!).leagues[0].nick).toBe('Alec');
    expect(view).toBeTruthy();
  });

  it('WHEN the name is taken THEN it says so and stays on the form', async () => {
    inFamily({ ...FAMILY, pin: true });
    mine(true);
    m.boardSetNick.mockRejectedValue(new BoardError('nick_taken'));
    await renderWithProviders(<LeaguesScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: /League settings/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Change nickname' }));
    await fireEvent.changeText(screen.getByLabelText('Nickname'), 'Mum');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByText(/already uses that nickname/)).toBeOnTheScreen());
    expect(screen.getByTestId('nick-form')).toBeOnTheScreen();
  });
});
