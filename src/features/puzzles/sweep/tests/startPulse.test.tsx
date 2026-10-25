import { act, fireEvent, screen } from '@testing-library/react-native';

import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { SweepScreen } from '../components/SweepScreen';
import { file94 } from './fixtures';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));

const START = 22;

beforeEach(() => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
  mockSite({});
});
afterEach(async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
});

describe('GIVEN a Sweep board before the first dig', () => {
  describe('WHEN it shows, and then the start is dug', () => {
    it('THEN only the safe start pulses marigold, and the pulse stops once it is dug', async () => {
      await renderWithProviders(<SweepScreen file={file94} />);
      await fireEvent.press(screen.getByRole('button', { name: 'Play' }));
      expect(screen.getAllByTestId('sweep-start-pulse')).toHaveLength(1);
      await fireEvent.press(screen.getByTestId(`sq-${START}`));
      expect(screen.queryByTestId('sweep-start-pulse')).toBeNull();
    });
  });
});
