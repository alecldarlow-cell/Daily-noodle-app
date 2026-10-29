import { router } from 'expo-router';
import { Alert, type AlertButton } from 'react-native';

import { openPuzzle } from '../openPuzzle';

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
    openPuzzle(MINI, { name: 'Mini 105', path: 'reports/2026-10-24-crossword-mini-0105.html' }),
  );

  it('THEN it asks first, saying what would be replaced', () => {
    expect(router.push).not.toHaveBeenCalled();
    expect(alert.mock.calls[0]![0]).toBe('Replace your Mini in progress?');
    expect(alert.mock.calls[0]![1]).toBe(
      'Mini 105 is part-way. One Mini round is kept at a time, so playing Mini 106 replaces it.',
    );
    expect(buttons().map((b) => b.text)).toEqual(['Cancel', 'Go to Mini 105', 'Start Mini 106']);
    expect(buttons()[0]!.style).toBe('cancel');
    expect(alert.mock.calls[0]![3]).toEqual({ cancelable: true });
  });

  it('THEN Go to opens the kept round, and Start opens the new one', () => {
    buttons()[1]!.onPress!();
    expect(router.push).toHaveBeenLastCalledWith(route('2026-10-24-crossword-mini-0105'));
    buttons()[2]!.onPress!();
    expect(router.push).toHaveBeenLastCalledWith(route('2026-10-25-crossword-mini-0106'));
  });
});

describe('GIVEN another round is kept that the list doesn’t know', () => {
  it('THEN it still asks, offering only Cancel and Start', () => {
    openPuzzle(MINI, {});
    expect(alert.mock.calls[0]![1]).toMatch(/^Your other Mini is part-way\./);
    expect(buttons().map((b) => b.text)).toEqual(['Cancel', 'Start Mini 106']);
  });
});
