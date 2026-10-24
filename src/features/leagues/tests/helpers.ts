/* Test helpers for leagues: a clean store, a saved board state, and the mocked server. */
import { BOARD_KEY, readBoard, type BoardState } from '@noodle/core';

import { appStorage } from '@/shared/storage';

import type { DayBoard, Overall } from '../types';

export const PID = '00000000-0000-4000-8000-000000000001';
export const OTHER = '00000000-0000-4000-8000-000000000002';

export function clearStore() {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
}

export function setBoard(s: BoardState) {
  appStorage.setItem(BOARD_KEY, JSON.stringify(s));
}

export const board = () => readBoard(appStorage);

export const FAMILY = {
  code: 'ABCD2345',
  name: 'Family',
  nick: 'Alec',
  owner: true,
  members: 3,
  pin: true,
};

export function mineRow(l = FAMILY) {
  return {
    code: l.code,
    name: l.name,
    nickname: l.nick,
    owner: l.owner,
    members: l.members,
    pin: l.pin,
  };
}

export function dayBoard(o: Partial<DayBoard> = {}): DayBoard {
  return {
    ranked: [
      { rank: 1, nick: 'Ma', me: false, outcome: 'solved', secs: 61, mistakes: null, streak: 3 },
      { rank: 2, nick: 'Alec', me: true, outcome: 'solved', secs: 87, mistakes: null, streak: 1 },
    ],
    unranked: [
      { nick: 'Jo', me: false, outcome: 'revealed', secs: null, mistakes: null, streak: 0 },
    ],
    not_yet: [{ nick: 'Piers', me: false }],
    players: ['Alec', 'Ma', 'Jo', 'Piers'],
    members: 4,
    first: '2026-10-01',
    ...o,
  };
}

export function overall(o: Partial<Overall> = {}): Overall {
  return {
    day: [
      { rank: 1, nick: 'Ma', me: false, points: 9, played: 4, completed: 4 },
      { rank: 2, nick: 'Alec', me: true, points: 1, played: 1, completed: 1 },
    ],
    week: [{ rank: 1, nick: 'Ma', me: false, points: 30, played: 12, completed: 11 }],
    not_yet: [],
    week_from: '2026-10-19',
    week_to: '2026-10-25',
    players: ['Alec', 'Ma'],
    members: 2,
    first: '2026-10-01',
    ...o,
  };
}
