import {
  shareBorders,
  shareDoku,
  shareMessage,
  shareMini,
  sharePath,
  shareReckon,
  shareSweep,
  shareTangle,
  shortLink,
} from '../share';

describe('GIVEN a finished puzzle', () => {
  describe('WHEN Mini, Doku or Path builds its share line', () => {
    it('THEN it matches the agreed examples', () => {
      expect(shareMini('DP·MINI·0100', '01:27', '5')).toBe('✏️ Mini #100 — 1:27 · 🔥5');
      expect(shareDoku('DP·LEXI·0098', '00:58', 5)).toBe('🔢 Doku #98 — 0:58 · 🔥5');
      expect(sharePath('DP·PATH·0093', '00:48', '5')).toBe('〰️ Path #93 — 0:48 · 🔥5');
    });
    it('THEN a streak of one is left off', () => {
      expect(shareMini('DP·MINI·0100', '01:27', '1')).toBe('✏️ Mini #100 — 1:27');
    });
  });

  describe('WHEN Sweep builds its share line', () => {
    it('THEN win, boom and revealed read as on the site', () => {
      expect(shareSweep('win', '00:35', '5', 'DP·SWEEP·2026-10-13')).toBe(
        '💣 Sweep 13 Oct — swept in 0:35 · 🔥5',
      );
      expect(shareSweep('loss', '00:35', '5', 'DP·SWEEP·2026-10-13')).toBe(
        '💥 Sweep 13 Oct — boom',
      );
      expect(shareSweep('gave', '00:35', '5', 'DP·SWEEP·2026-10-13')).toBe(
        '💣 Sweep 13 Oct — revealed',
      );
    });
  });

  describe('WHEN Tangle builds its share line', () => {
    it('THEN points and words are counted, singular when one', () => {
      expect(shareTangle(9, 30, 20, false)).toBe('🧶 Tangle #9 — 30 points, 20 words');
      expect(shareTangle(1, 1, 1, false)).toBe('🧶 Tangle #1 — 1 point, 1 word');
    });
    it('THEN finding the longest word adds a star', () => {
      expect(shareTangle(18, 42, 21, true)).toBe('🧶 Tangle #18 — 42 points, 21 words ★');
    });
  });

  describe('WHEN Borders builds its share line', () => {
    it('THEN it shows the score, points and a live streak of two or more', () => {
      expect(shareBorders('DP·BORD·0015', 7, 10, 640, 3)).toBe(
        '🌍 Borders #15 — 7/10 · 640 pts · 🔥3',
      );
      expect(shareBorders('DP·BORD·0015', 7, 10, 640, 1)).toBe('🌍 Borders #15 — 7/10 · 640 pts');
    });
    it('THEN an id without a number leaves the number out', () => {
      expect(shareBorders('DP·BORD·xxxx', 2, 10, 90, 0)).toBe('🌍 Borders — 2/10 · 90 pts');
    });
  });

  describe('WHEN Reckon builds its share line', () => {
    it('THEN each question becomes its zone square', () => {
      expect(shareReckon('DP·RECK·0001', [0, 1, 2, 4, 0, 0, 1, 3, 0, 2], 650, 3)).toBe(
        '🎯 Reckon #1 — 🎯🟩🟨⬜🎯🎯🟩🟧🎯🟨 · 650 pts · 🔥3',
      );
    });
  });

  describe('WHEN the message is shared', () => {
    it('THEN the short link follows the line on its own line', () => {
      expect(shortLink('mini')).toBe('dailynoodle.co.uk/mini');
      expect(shareMessage('mini', 'line')).toBe('line\ndailynoodle.co.uk/mini');
    });
  });
});
