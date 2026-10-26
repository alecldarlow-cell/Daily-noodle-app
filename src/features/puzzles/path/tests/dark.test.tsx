import { act, fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { pathColors } from '../components/colors';
import { PathScreen } from '../components/PathScreen';
import { file92, path92 } from './fixtures';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => 'dark',
}));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.setTimeout(30_000);

const at: [number, number][] = [];
path92.solution.forEach((row, r) => row.forEach((v, c) => (at[v] = [r, c])));
const tapValue = (v: number) => fireEvent.press(screen.getByTestId(`sq-${at[v]![0]}-${at[v]![1]}`));

/** WCAG contrast of two #RRGGBB colours. */
function contrast(a: string, b: string) {
  const lum = (h: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const v = parseInt(h.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

beforeEach(() => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
  mockSite({});
});
afterEach(async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
});

describe('GIVEN Path in dark mode', () => {
  it('THEN both threads read on the dark card (the page’s deep blue was about 1.3:1)', () => {
    const card = '#2E3344';
    const dark = pathColors(true);
    expect(contrast('#1B3B9E', card)).toBeLessThan(1.5);
    for (const c of [dark.low, dark.high, dark.done]) expect(contrast(c, card)).toBeGreaterThan(3);
    expect(pathColors(false)).toEqual({ low: '#2E5BFF', high: '#1B3B9E', done: '#1F9E6B' });
  });

  describe('WHEN the thread grows down from 36', () => {
    it('THEN it is drawn in the dark high-thread colour, not the page’s literal', async () => {
      await renderWithProviders(<PathScreen file={file92} />);
      await fireEvent.press(screen.getByRole('button', { name: 'Play' }));
      await tapValue(36);
      await tapValue(35);
      const bars = screen.getAllByTestId('thread-bar');
      expect(bars).toHaveLength(1);
      expect(StyleSheet.flatten(bars[0]!.props.style).backgroundColor).toBe(pathColors(true).high);
    });
  });
});
