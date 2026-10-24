import { render, screen } from '@testing-library/react-native';

import { PlayScreen } from '../components/PlayScreen/PlayScreen';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams }));

describe('GIVEN a puzzle is opened', () => {
  it('THEN its type names the screen', async () => {
    mockParams = { type: 'mini', file: '2026-10-24-crossword-mini-0105' };
    await render(<PlayScreen />);
    expect(screen.getByRole('header', { name: 'Mini' })).toBeOnTheScreen();
  });
  it('THEN an unknown type is just a puzzle', async () => {
    mockParams = { type: 'x', file: 'y' };
    await render(<PlayScreen />);
    expect(screen.getByRole('header', { name: 'Puzzle' })).toBeOnTheScreen();
  });
});
