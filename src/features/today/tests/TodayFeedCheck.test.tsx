/* Hardening R9: malformed or mismatched cards in feed-lite.json never break Today. */
import { londonDay } from '@noodle/core';
import { act, screen, waitFor } from '@testing-library/react-native';

import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { TodayScreen } from '../components/TodayScreen/TodayScreen';
import { todayList } from './fixtures';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const today = londonDay();

beforeEach(() => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
});

afterEach(async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });
});

describe('GIVEN today’s list, and a card list with malformed and mismatched cards', () => {
  describe('WHEN Today opens', () => {
    it('THEN all eight puzzles show, each with only its own card’s text', async () => {
      mockSite({
        'puzzles-today.json': todayList(),
        'feed-lite.json': {
          built: today,
          today,
          count: 4,
          items: [
            null,
            // Mini's id on a Doku card: not Mini's text.
            {
              path: 'reports/2026-10-24-logic-doku-0103.html',
              type: 'doku',
              id: 'DP·MINI·0105',
              date: today,
              headline: 'Doku 103',
              standfirst: 'Wrong card',
            },
            { id: 'DP·LINK·0077', standfirst: 'Half a card' },
            {
              path: 'reports/2026-10-24-logic-doku-0103.html',
              type: 'doku',
              id: 'DP·LEXI·0103',
              date: today,
              headline: 'Doku 103',
              standfirst: 'Good Doku card',
              read: '~4 min',
              mask: '',
              json: null,
            },
          ],
        },
      });
      await renderWithProviders(<TodayScreen />);
      await waitFor(() => expect(screen.getByText('Good Doku card')).toBeOnTheScreen());
      expect(screen.getByTestId('today-count')).toHaveTextContent('8 puzzles');
      expect(screen.getByTestId('today-reckon')).toBeOnTheScreen();
      expect(screen.queryByText('Wrong card')).toBeNull();
      expect(screen.queryByText('Half a card')).toBeNull();
    });
  });
});
