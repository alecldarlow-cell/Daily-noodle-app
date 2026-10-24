import { londonDay } from '@noodle/core';
import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { longDate, monthLabel, shortDate } from '../format';
import { msToNextLondonDay, useLondonDay } from '../useLondonDay';

describe('GIVEN an instant', () => {
  describe('WHEN the time to the next London day is worked out', () => {
    it('THEN it lands just after London midnight, in BST and GMT', () => {
      for (const iso of ['2026-10-24T09:00:00Z', '2026-10-25T09:00:00Z', '2026-12-01T23:59:00Z']) {
        const now = Date.parse(iso);
        const next = now + msToNextLondonDay(now);
        expect(londonDay(next)).not.toBe(londonDay(now));
        expect(londonDay(next - 60_000)).toBe(londonDay(now));
      }
    });
  });
});

describe('GIVEN days to show', () => {
  it('THEN they read the British way', () => {
    expect(shortDate('2026-10-24')).toBe('Sat 24 Oct');
    expect(monthLabel('2026-10-24')).toBe('October 2026');
    expect(longDate('2026-10-24')).toBe('Saturday 24 October');
    expect(longDate('2026-09-01')).toBe('Tuesday 1 September');
  });
  it('THEN a day that is not a date is shown as it came', () => {
    expect(longDate('soon')).toBe('soon');
  });
});

describe('GIVEN the app is open across London midnight', () => {
  afterEach(() => jest.useRealTimers());

  it('THEN the day moves on at midnight and on coming back to the app', async () => {
    jest.useFakeTimers({ now: Date.parse('2026-10-24T22:59:00Z') }); // 23:59 BST
    const listeners: ((s: string) => void)[] = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_e, fn) => {
      listeners.push(fn as (s: string) => void);
      return { remove: jest.fn() } as never;
    });
    const { result } = await renderHook(() => useLondonDay());
    expect(result.current).toBe('2026-10-24');
    await act(async () => {
      jest.advanceTimersByTime(2 * 60_000);
    });
    expect(result.current).toBe('2026-10-25');
    jest.setSystemTime(Date.parse('2026-10-26T09:00:00Z'));
    await act(async () => listeners.at(-1)?.('active'));
    expect(result.current).toBe('2026-10-26');
  });
});

describe('GIVEN a September day', () => {
  it('THEN it is "Sep", as the site writes it', () => {
    expect(shortDate('2026-09-01')).toBe('Tue 1 Sep');
    expect(monthLabel('2026-09-01')).toBe('September 2026');
  });
});
