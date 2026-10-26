import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { forgetReduceMotion } from '@/shared/motion';
import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { MISS_MS } from '../components/LinkMotion';
import { LinkScreen } from '../components/LinkScreen';
import { SETTLE_MS } from '../model';
import { link78, file78 } from './fixtures';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.setTimeout(30_000);

const G = link78.groups.map((g) => g.members);
async function run(ms: number) {
  for (let t = 0; t < ms; t += 100)
    await act(async () => {
      jest.advanceTimersByTime(Math.min(100, ms - t));
    });
}
const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));
async function pick(ws: string[]) {
  if (screen.getByRole('button', { name: 'Deselect' }).props.accessibilityState?.disabled === false)
    await press('Deselect');
  for (const w of ws) await fireEvent.press(screen.getByTestId(`tile-${w}`));
  await press('Submit');
}
const motion = (reduced: boolean) =>
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reduced);

beforeEach(() => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
  forgetReduceMotion();
  jest.useFakeTimers();
  mockSite({});
});
afterEach(async () => {
  await run(100);
  jest.useRealTimers();
  jest.restoreAllMocks();
});

async function open() {
  await renderWithProviders(<LinkScreen file={file78} />);
  await act(async () => undefined);
  await press('Play');
}

describe('GIVEN a Link in play with motion allowed', () => {
  describe('WHEN a wrong four is submitted', () => {
    it('THEN the four go red and wobble while the spent pip flashes out, then settle back', async () => {
      motion(false);
      await open();
      const wrong = [G[1]![0]!, G[1]![1]!, G[1]![2]!, G[2]![0]!];
      await pick(wrong);
      await run(100);
      expect(screen.getAllByTestId('link-wobble')).toHaveLength(4);
      for (const w of wrong) {
        const tile = within(screen.getByTestId(`tile-${w}`));
        expect(tile.getByText(w)).toHaveStyle({ color: '#E4483B' });
      }
      expect(screen.getByTestId('pip-lost')).toBeOnTheScreen();
      expect(screen.getAllByTestId('pip-gone')).toHaveLength(1);
      await run(MISS_MS);
      expect(within(screen.getByTestId(`tile-${wrong[0]}`)).getByText(wrong[0]!)).not.toHaveStyle({
        color: '#E4483B',
      });
    });

    it('THEN a repeat of a guess wobbles too, and costs nothing', async () => {
      motion(false);
      await open();
      const wrong = [G[1]![0]!, G[1]![1]!, G[1]![2]!, G[2]![0]!];
      await pick(wrong);
      await run(MISS_MS + 100);
      await pick(wrong);
      await run(100);
      expect(screen.getByTestId('link-msg')).toHaveTextContent('Already tried that one');
      expect(screen.getAllByTestId('link-wobble')).toHaveLength(4);
      expect(screen.getAllByTestId('pip-gone')).toHaveLength(1);
    });
  });

  describe('WHEN a right four is submitted', () => {
    it('THEN its tiles settle one by one and fly, and the band lands with a swell', async () => {
      motion(false);
      await open();
      await pick(G[0]!);
      await run(100);
      expect(screen.getAllByTestId('link-settle')).toHaveLength(4);
      expect(screen.queryByTestId('band-1')).toBeNull();
      await run(SETTLE_MS);
      expect(screen.getByTestId('band-1')).toBeOnTheScreen();
      expect(within(screen.getByTestId('band-1')).getByTestId('link-landing')).toBeOnTheScreen();
      expect(screen.queryAllByTestId('link-settle')).toHaveLength(0);
      // the next band lands; the first is still and stays
      await pick(G[1]!);
      await run(SETTLE_MS + 100);
      expect(within(screen.getByTestId('band-2')).getByTestId('link-landing')).toBeOnTheScreen();
      expect(within(screen.getByTestId('band-1')).queryByTestId('link-landing')).toBeNull();
    });
  });
});

describe('GIVEN a phone asking for reduced motion', () => {
  it('THEN nothing wobbles, flies or swells', async () => {
    motion(true);
    await open();
    await pick([G[1]![0]!, G[1]![1]!, G[1]![2]!, G[2]![0]!]);
    await run(100);
    expect(screen.queryAllByTestId('link-wobble')).toHaveLength(0);
    expect(screen.queryByTestId('pip-lost')).toBeNull();
    await pick(G[0]!);
    await run(100);
    expect(screen.queryAllByTestId('link-settle')).toHaveLength(0);
    expect(screen.getByTestId('band-1')).toBeOnTheScreen();
    expect(screen.queryByTestId('link-landing')).toBeNull();
  });
});
