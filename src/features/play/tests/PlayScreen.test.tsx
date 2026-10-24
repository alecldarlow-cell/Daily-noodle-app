import { render, screen } from '@testing-library/react-native';

import { PlayScreen } from '../components/PlayScreen/PlayScreen';

let mockParams: Record<string, string> = {};
const mockTitles: string[] = [];
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  Stack: {
    Screen: ({ options }: { options: { title: string } }) => (mockTitles.push(options.title), null),
  },
}));
jest.mock('@/shared/webview', () => {
  const { Text } = jest.requireActual('react-native');
  return { PuzzleWebView: ({ file }: { file: string }) => <Text>{`page:${file}`}</Text> };
});

describe('GIVEN a puzzle is opened', () => {
  beforeEach(() => (mockTitles.length = 0));

  it('THEN its page plays in the bridge under its type’s name', async () => {
    mockParams = { type: 'mini', file: '2026-10-24-crossword-mini-0105' };
    await render(<PlayScreen />);
    expect(screen.getByText('page:2026-10-24-crossword-mini-0105')).toBeOnTheScreen();
    expect(mockTitles).toContain('Mini');
  });

  it('THEN an unknown type is just a puzzle', async () => {
    mockParams = { type: 'x', file: 'y' };
    await render(<PlayScreen />);
    expect(mockTitles).toContain('Puzzle');
  });
});
