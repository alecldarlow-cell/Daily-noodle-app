import {
  byFinished,
  HONOURS,
  leaders,
  playerLine,
  playerMark,
  recordRows,
} from '../hooks/recordsText';
import { result } from '../hooks/boardText';
import { recordsData } from './helpers';

const d = recordsData('2026-10-26');

describe('GIVEN a league’s records', () => {
  describe('WHEN the records are listed', () => {
    it('THEN only puzzles with a record show, in pill order', () => {
      expect(recordRows(d).map((r) => r.type)).toEqual(['mini', 'link', 'tangle']);
      expect(recordRows({ ...d, records: {} })).toEqual([]);
    });
  });

  describe('WHEN a record’s result is written', () => {
    it('THEN it reads as the board writes a finished result: time, mistakes, or points', () => {
      expect(result('mini', d.records.mini!)).toEqual({ big: '0:30', small: '' });
      expect(result('link', d.records.link!)).toEqual({ big: '1:35', small: '1 mistake' });
      // Tangle: points only, no time (AF-025).
      expect(result('tangle', d.records.tangle!)).toEqual({ big: '57 pts', small: '' });
    });
  });

  describe('WHEN the honours are worked out', () => {
    it('THEN each names its leader or joint leaders, and nobody while the top is 0', () => {
      expect(HONOURS.map((h) => h.name)).toEqual([
        'Longest streak',
        'Current streak',
        'Daily wins',
        'Weekly titles',
        'Perfect days',
        'Clean sweeps',
        'Puzzles finished',
      ]);
      expect(leaders(d.players, 'longest')).toEqual({ top: 5, who: ['Alec', 'Ma'] });
      expect(leaders(d.players, 'wins')).toEqual({ top: 9, who: ['Ma'] });
      expect(leaders([], 'titles')).toEqual({ top: 0, who: [] });
      expect(leaders(d.players.slice(2), 'perfect')).toEqual({ top: 0, who: [] });
      expect(HONOURS[0]!.unit(1)).toBe('1 day');
      expect(HONOURS[1]!.unit(3)).toBe('3 days');
    });
  });

  describe('WHEN the players are listed', () => {
    it('THEN most finished goes first, marked by titles then wins, with their line', () => {
      expect(byFinished(d.players).map((p) => p.nick)).toEqual(['Ma', 'Alec', 'Jo']);
      expect(d.players.map(playerMark)).toEqual(['🥇', '👑', '·']);
      expect(playerLine(d.players[1]!)).toBe('9 wins · 1 title · best streak 5');
      expect(playerLine({ ...d.players[0]!, wins: 1, titles: 0 })).toBe(
        '1 win · 0 titles · best streak 5',
      );
    });
  });
});
