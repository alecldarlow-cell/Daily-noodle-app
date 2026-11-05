import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { appStorage } from '@/shared/storage';
import { renderWithProviders } from '@/shared/testing';

import * as board from '../api/board';
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
    await waitFor(() => expect(screen.getByTestId('crown-note')).toBeOnTheScreen());
    expect(screen.getByText('👑 Last week’s champion')).toBeOnTheScreen();
  });
});
