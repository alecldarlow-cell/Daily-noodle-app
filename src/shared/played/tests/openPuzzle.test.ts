import { router } from 'expo-router';
import { Alert, type AlertButton } from 'react-native';

import { dayWord, openPuzzle } from '../openPuzzle';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const MINI = {
  type: 'mini' as const,
  name: 'Mini 106',
  path: 'reports/2026-10-25-crossword-mini-0106.html',
};
const route = (file: string) => ({
  pathname: '/play/[type]/[file]',
  params: { type: 'mini', file },
});

let alert: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => alert.mockRestore());

const buttons = () => alert.mock.calls[0]![2] as AlertButton[];

describe('GIVEN no other round of the type is kept', () => {
  it('THEN tapping the card opens the puzzle straight away', () => {
    openPuzzle(MINI, null);
    expect(alert).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith(route('2026-10-25-crossword-mini-0106'));
  });
});

describe('GIVEN another Mini’s round is kept and the list knows it', () => {
  beforeEach(() =>
    openPuzzle(
      MINI,
      { name: 'Mini 105', path: 'reports/2026-10-24-crossword-mini-0105.html' },
      undefined,
      '2026-10-25',
    ),
  );

  it('THEN it asks first, naming both with their day and what would be lost', () => {
    expect(router.push).not.toHaveBeenCalled();
    expect(alert.mock.calls[0]![0]).toBe('Mini 105 isn’t finished');
    expect(alert.mock.calls[0]![1]).toBe(
      'You started Mini 105 (yesterday) and haven’t finished it. Only one Mini can be part-played at a time, so starting Mini 106 (today) loses your progress on Mini 105.',
    );
    expect(buttons().map((b) => b.text)).toEqual([
      'Cancel',
      'Carry on with Mini 105',
      'Start Mini 106 instead',
    ]);
    expect(buttons()[0]!.style).toBe('cancel');
    expect(buttons()[2]!.style).toBe('destructive');
    expect(alert.mock.calls[0]![3]).toEqual({ cancelable: true });
  });

  it('THEN Carry on opens the kept round, and Start opens the new one', () => {
    buttons()[1]!.onPress!();
    expect(router.push).toHaveBeenLastCalledWith(route('2026-10-24-crossword-mini-0105'));
    buttons()[2]!.onPress!();
    expect(router.push).toHaveBeenLastCalledWith(route('2026-10-25-crossword-mini-0106'));
  });
});

describe('GIVEN today’s Link is tapped while an older Link is part-played (Alec, 9 Nov 2026)', () => {
  it('THEN the older one is named with its date, so the two can’t be mixed up', () => {
    openPuzzle(
      { type: 'link', name: 'Link 93', path: 'reports/2026-11-09-word-link-0093.html' },
      { name: 'Link 87', path: 'reports/2026-11-03-word-link-0087.html' },
      undefined,
      '2026-11-09',
    );
    expect(alert.mock.calls[0]![1]).toBe(
      'You started Link 87 (Tue 3 Nov) and haven’t finished it. Only one Link can be part-played at a time, so starting Link 93 (today) loses your progress on Link 87.',
    );
    expect(buttons().map((b) => b.text)).toEqual([
      'Cancel',
      'Carry on with Link 87',
      'Start Link 93 instead',
    ]);
  });
});

describe('GIVEN another round is kept that the list doesn’t know', () => {
  it('THEN it still asks, offering only Cancel and Start', () => {
    openPuzzle(MINI, {}, undefined, '2026-10-25');
    expect(alert.mock.calls[0]![0]).toBe('Another Mini isn’t finished');
    expect(alert.mock.calls[0]![1]).toMatch(/^You have another Mini part-played\./);
    expect(alert.mock.calls[0]![1]).toMatch(/loses its progress\.$/);
    expect(buttons().map((b) => b.text)).toEqual(['Cancel', 'Start Mini 106 instead']);
  });
});

describe('GIVEN a puzzle’s path', () => {
  it('THEN its day reads today, yesterday, a short date, or nothing when the path has none', () => {
    expect(dayWord('reports/2026-11-09-word-link-0093.html', '2026-11-09')).toBe('today');
    expect(dayWord('reports/2026-11-08-word-link-0092.html', '2026-11-09')).toBe('yesterday');
    expect(dayWord('reports/2026-11-03-word-link-0087.html', '2026-11-09')).toBe('Tue 3 Nov');
    expect(dayWord('reports/2026-03-01-word-link-0001.html', '2026-03-02')).toBe('yesterday');
    expect(dayWord('reports/word-link.html', '2026-11-09')).toBe('');
    expect(dayWord(undefined, '2026-11-09')).toBe('');
  });
});

describe('GIVEN a player opens the puzzle with its own opener', () => {
  it('THEN that opener is used, straight away and from Start, and push is not', () => {
    const open = jest.fn();
    openPuzzle(MINI, null, open);
    expect(open).toHaveBeenCalledWith(route('2026-10-25-crossword-mini-0106'));
    openPuzzle(MINI, {}, open);
    buttons()[1]!.onPress!();
    expect(open).toHaveBeenCalledTimes(2);
    expect(router.push).not.toHaveBeenCalled();
  });
});
