import { render, screen, fireEvent, within } from '@testing-library/react-native';

import { StartCard } from '../StartCard';
import { HOUSE_LINE, HOW, houseLine, ruleFor } from '../copy';

/*
 * Alec, 8 Nov 2026: every puzzle's open page says the house line (the card description, from
 * dailynoodle tools/standfirst.js) and the old rule sentence, counts and all, leads How to play.
 * The strings are the site's generated dnHouseLine block, word for word.
 */
const stats = { streak: 0, best: 0, played: 0 };
const noop = () => {};

describe('GIVEN each type’s house line', () => {
  it('THEN it is the site’s card description, word for word', () => {
    expect(HOUSE_LINE).toEqual({
      mini: 'A crossword small enough for a coffee break. Fill every square from the clues.',
      doku: 'A crossword with no clues. Place every letter so each line spells a word.',
      sweep: 'Find the mines with logic alone. Flag them, then clear the grid.',
      path: 'One unbroken trail from 1 to 36. Tap square by square to build it.',
      tangle: 'Search for words before the clock runs out. The longer, the better.',
      borders: 'Name the country from its outline. Size, sea and shape are your clues.',
      reckon: 'Guesstimate your way to winning. What do you reckon?',
      tally: 'Sudoku with a maths twist. Can you make every cage hit its number?',
    });
    expect(houseLine('doku', { traps: [{}] })).toBe(HOUSE_LINE.doku);
  });

  describe('WHEN it is a Link', () => {
    it('THEN it carries the day’s trap count, worded for none, one and many', () => {
      const base = 'Four hidden groups. Can you find the links?';
      expect(houseLine('link')).toBe(base);
      expect(houseLine('link', { traps: [] })).toBe(base);
      expect(houseLine('link', { traps: null })).toBe(base);
      expect(houseLine('link', { traps: [{}] })).toBe(`${base} Today, one tile is bluffing.`);
      expect(houseLine('link', { traps: [{}, {}, {}] })).toBe(
        `${base} Today, three tiles are bluffing.`,
      );
      expect(houseLine('link', { traps: Array(8).fill({}) })).toBe(
        `${base} Today, eight tiles are bluffing.`,
      );
      expect(houseLine('link', { traps: Array(9).fill({}) })).toBe(
        `${base} Today, 9 tiles are bluffing.`,
      );
    });
  });
});

describe('GIVEN a Link not yet played with three traps', () => {
  describe('WHEN its start card shows and How to play is opened', () => {
    it('THEN the card says the house line with the count, and the rule is How to play’s first paragraph', async () => {
      await render(
        <StartCard
          type="link"
          n={78}
          date="2026-10-25"
          line={houseLine('link', { traps: [{}, {}, {}] })}
          rule={ruleFor('link', {})}
          stats={stats}
          onPlay={noop}
          onBack={noop}
        />,
      );
      expect(
        screen.getByText(
          'Four hidden groups. Can you find the links? Today, three tiles are bluffing.',
        ),
      ).toBeOnTheScreen();
      expect(screen.queryByText(/^Sixteen words/)).toBeNull();
      await fireEvent.press(screen.getByRole('button', { name: /How to play/ }));
      const paras = [
        screen.getByText(/^Sixteen words/),
        screen.getByText(HOW.link[0]!),
        screen.getByText(HOW.link[1]!),
      ];
      const all = screen.getAllByText(/./).map((n) => n.props.children);
      const at = paras.map((p) => all.indexOf(p.props.children));
      expect(at[0]).toBeLessThan(at[1]!);
      expect(at[1]).toBeLessThan(at[2]!);
      expect(paras[0]).toHaveTextContent(
        'Sixteen words, four hidden groups of four. Four mistakes and it’s over.',
      );
    });
  });
});

describe('GIVEN a Sweep not yet played with seven mines', () => {
  describe('WHEN its start card shows', () => {
    it('THEN the mine count has moved from the card to How to play', async () => {
      const rule = ruleFor('sweep', { mines: [1, 2, 3, 4, 5, 6, 7] });
      expect(rule).toBe(
        'Clear the board without hitting one of the seven mines. Start on the highlighted square.',
      );
      await render(
        <StartCard
          type="sweep"
          n={94}
          date="2026-10-18"
          rule={rule}
          stats={stats}
          onPlay={noop}
          onBack={noop}
        />,
      );
      // line left out: the card falls back to the type's house line
      expect(screen.getByText(HOUSE_LINE.sweep)).toBeOnTheScreen();
      expect(screen.queryByText(/seven mines/)).toBeNull();
      await fireEvent.press(screen.getByRole('button', { name: /How to play/ }));
      expect(screen.getByText(rule)).toBeOnTheScreen();
    });
  });
});

describe('GIVEN a part-played round', () => {
  it('THEN the card keeps its progress line, and How to play still leads with the rule', async () => {
    await render(
      <StartCard
        type="link"
        n={78}
        date="2026-10-25"
        line={houseLine('link', { traps: [{}] })}
        rule={ruleFor('link', {})}
        stats={stats}
        resume={{ head: 'Part-played', status: 'Paused at 1:02. One group found so far.' }}
        onPlay={noop}
        onBack={noop}
      />,
    );
    expect(screen.getByText('Paused at 1:02. One group found so far.')).toBeOnTheScreen();
    expect(screen.queryByText(/bluffing/)).toBeNull();
    expect(within(screen.getByTestId('start-card')).getByText('Resume')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: /How to play/ }));
    expect(screen.getByText(/^Sixteen words/)).toBeOnTheScreen();
  });
});
