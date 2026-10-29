/** AF-010: a shared dailynoodle.co.uk/<type> link opens today's puzzle of that type. */
import { act, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { TodayScreen } from '../components/TodayScreen/TodayScreen';
import { todayList } from './fixtures';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.setTimeout(30_000);

beforeEach(() => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
  jest.clearAllMocks();
});
afterEach(async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });
});

describe('GIVEN Today opened from a shared Mini link', () => {
  describe('WHEN today’s list arrives', () => {
    it('THEN today’s Mini opens, once, and the link’s request is used up', async () => {
      mockSite({ 'puzzles-today.json': todayList() });
      const onOpened = jest.fn();
      await renderWithProviders(<TodayScreen open="mini" onOpened={onOpened} />);
      await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/play/[type]/[file]',
        params: { type: 'mini', file: '2026-10-24-crossword-mini-0105' },
      });
      expect(onOpened).toHaveBeenCalledTimes(1);
      // Later renders (the feed arriving, the clock) don't open it again.
      await act(async () => {
        await new Promise((r) => setTimeout(r, 200));
      });
      expect(router.push).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('today-mini')).toBeOnTheScreen();
    });
  });

  describe('WHEN another Mini holds the kept round', () => {
    it('THEN it asks first, as a tap on the card does', async () => {
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      appStorage.setItem(
        'noodle-app-progress-mini',
        JSON.stringify({ v: 1, id: 'DP·MINI·0104', secs: 30, moves: [{ t: 'cell', r: 0, c: 0 }] }),
      );
      mockSite({ 'puzzles-today.json': todayList() });
      await renderWithProviders(<TodayScreen open="mini" />);
      await waitFor(() => expect(alert).toHaveBeenCalledTimes(1));
      expect(alert.mock.calls[0]![0]).toBe('Replace your Mini in progress?');
      expect(router.push).not.toHaveBeenCalled();
      alert.mockRestore();
    });
  });
});

describe('GIVEN Today opened without a link', () => {
  it('THEN nothing opens by itself', async () => {
    mockSite({ 'puzzles-today.json': todayList() });
    await renderWithProviders(<TodayScreen />);
    await waitFor(() => expect(screen.getByTestId('today-mini')).toBeOnTheScreen());
    expect(router.push).not.toHaveBeenCalled();
  });
});
