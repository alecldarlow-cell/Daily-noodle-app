import { act, screen, waitFor } from '@testing-library/react-native';
import { RefreshControl, type RefreshControlProps } from 'react-native';

import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';
import { tokensFor } from '@/shared/theme';

import { TodayScreen } from '../components/TodayScreen/TodayScreen';
import { todayList } from './fixtures';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

/** React Native's Jest mock keeps the last RefreshControl mounted, with its props. */
const pull = () =>
  (RefreshControl as unknown as { latestRef: { props: RefreshControlProps } }).latestRef.props;

/** A site that doesn't answer until the test is over (then the fetch, and its timer, end). */
let release: (() => void) | undefined;
const hold = () => {
  globalThis.fetch = jest.fn(
    () =>
      new Promise((_, reject) => {
        release = () => reject(new TypeError('Network request failed'));
      }),
  ) as unknown as typeof fetch;
};

beforeEach(() => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
  jest.clearAllMocks();
});

afterEach(async () => {
  release?.();
  release = undefined;
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });
});

describe('GIVEN the site hasn’t answered yet', () => {
  describe('WHEN Today opens', () => {
    it('THEN rows in the cards’ shape show while it loads, not a lone spinner', async () => {
      hold();
      await renderWithProviders(<TodayScreen />);
      expect(screen.getByTestId('today-loading')).toBeOnTheScreen();
      expect(screen.getByRole('progressbar', { name: 'Loading puzzles' })).toBeOnTheScreen();
      expect(screen.getAllByTestId('today-loading-row')).toHaveLength(6);
    });
  });
});

describe('GIVEN the phone is online but the site answers with an error', () => {
  describe('WHEN Today opens with nothing saved', () => {
    it('THEN it says the puzzles couldn’t load, not “No connection”, with Try again', async () => {
      mockSite({}); // every file a 404
      await renderWithProviders(<TodayScreen />);
      await waitFor(() => expect(screen.getByTestId('today-failed')).toBeOnTheScreen());
      expect(screen.queryByTestId('today-offline')).toBeNull();
      expect(screen.queryByText('No connection')).toBeNull();
      expect(screen.getByText('Couldn’t load today’s puzzles')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
    });
  });
});

describe('GIVEN today’s list on the screen', () => {
  describe('WHEN it is pulled down to refresh', () => {
    it('THEN the house-coloured spinner shows until the site answers, then goes', async () => {
      let answer!: () => void;
      const site = mockSite({ 'puzzles-today.json': todayList() });
      await renderWithProviders(<TodayScreen />);
      await waitFor(() => expect(screen.getByTestId('today-mini')).toBeOnTheScreen());
      expect(pull().refreshing).toBe(false);
      expect(pull().colors).toEqual([tokensFor('light').accent]);

      // the next fetch waits until we let it answer
      const gate = new Promise<void>((r) => (answer = r));
      site.mockImplementationOnce(async () => {
        await gate;
        return { ok: true, status: 200, json: async () => todayList() };
      });
      const calls = site.mock.calls.length;
      await act(async () => pull().onRefresh!());
      await waitFor(() => expect(site.mock.calls.length).toBeGreaterThan(calls));
      expect(pull().refreshing).toBe(true);

      await act(async () => answer());
      await waitFor(() => expect(pull().refreshing).toBe(false));
      expect(screen.getByTestId('today-mini')).toBeOnTheScreen();
    });
  });
});
