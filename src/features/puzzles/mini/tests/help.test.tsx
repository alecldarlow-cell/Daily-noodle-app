import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/shared/testing';

import { MiniHelp, wordName } from '../components/MiniHelp';

describe('GIVEN the Mini’s Help sheet', () => {
  describe('WHEN it names the active word', () => {
    it('THEN "6A" reads 6 Across, "2D" 2 Down, and no word reads This word', () => {
      expect(wordName('6A')).toBe('6 Across');
      expect(wordName('2D')).toBe('2 Down');
      expect(wordName(undefined)).toBe('This word');
      expect(wordName('7')).toBe('7');
    });
  });

  describe('WHEN it is open and an option is chosen', () => {
    it('THEN the options run in order of reach, each does its move, and the sheet closes', async () => {
      const calls: string[] = [];
      const onClose = jest.fn();
      await renderWithProviders(
        <MiniHelp
          open
          word="6A"
          onClose={onClose}
          onCheckCell={() => calls.push('cell')}
          onCheckWord={() => calls.push('word')}
          onCheckAll={() => calls.push('all')}
          onRevealWord={() => calls.push('reveal')}
        />,
      );
      expect(screen.getByRole('header', { name: 'Help' })).toBeOnTheScreen();
      expect(screen.getAllByText('6 Across')).toHaveLength(2);
      for (const name of ['Check square', 'Check word', 'Check all', 'Reveal word'])
        await fireEvent.press(screen.getByRole('button', { name }));
      expect(calls).toEqual(['cell', 'word', 'all', 'reveal']);
      expect(onClose).toHaveBeenCalledTimes(4);
      await fireEvent.press(screen.getByRole('button', { name: 'Close help' }));
      await fireEvent.press(screen.getByTestId('mini-help-scrim'));
      expect(onClose).toHaveBeenCalledTimes(6);
    });
  });
});
