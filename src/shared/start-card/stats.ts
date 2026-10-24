import { dayBefore, saveKey, streakKey, type GridStreakType } from '@noodle/core';

export interface StartStats {
  /** The streak while it is alive (last played today or yesterday), else 0, as house.js shows it. */
  streak: number;
  best: number;
  /** Puzzles of this type finished on this device. */
  played: number;
}

type Doc = Record<string, unknown> | null | undefined;

/** The start card's three numbers from the type's two saved documents. */
export function startStats(saveDoc: unknown, streakDoc: unknown, today: string): StartStats {
  const save = saveDoc as Doc;
  const st = (streakDoc && typeof streakDoc === 'object' ? streakDoc : {}) as Record<
    string,
    unknown
  >;
  const done = save && save.done && typeof save.done === 'object' ? save.done : null;
  const live = st.last === today || st.last === dayBefore(today) ? Number(st.streak) || 0 : 0;
  return { streak: live, best: Number(st.best) || 0, played: done ? Object.keys(done).length : 0 };
}

export const keysFor = (type: GridStreakType) => [saveKey(type), streakKey(type)] as const;
