/**
 * The finish sheet's board slot, filled from outside shared: the root provides a
 * component (leagues' "See today's board"), and every native finish sheet draws it with
 * the puzzle's path, type and day. Shared never imports a feature; the feature comes in
 * through this context. The component can tag the share line (a league record adds 🏆),
 * as dn-board.js does through engines/finish.js `dnFinish.tag`.
 */
import type { PuzzleType } from '@noodle/core';
import {
  createContext,
  createElement,
  useContext,
  useMemo,
  type ComponentType,
  type ReactNode,
} from 'react';

export interface BoardSlotProps {
  /** "reports/<file>.html": how the site and leagues name the puzzle. */
  path: string;
  type: PuzzleType;
  /** The puzzle's day, YYYY-MM-DD. */
  date: string;
  /** Add a tag to the end of the share line's first line (finish.js `tag`). */
  onTag: (tag: string) => void;
}

export type BoardSlotComponent = ComponentType<BoardSlotProps>;

export type RenderBoardSlot = (props: BoardSlotProps) => ReactNode;

const SlotContext = createContext<RenderBoardSlot | null>(null);

export function BoardSlotProvider({
  slot,
  children,
}: {
  slot: BoardSlotComponent | null;
  children: ReactNode;
}) {
  const render = useMemo<RenderBoardSlot | null>(
    () => (slot ? (props) => createElement(slot, props) : null),
    [slot],
  );
  return <SlotContext.Provider value={render}>{children}</SlotContext.Provider>;
}

/** Draws the provided board slot; null when none is (tests, or a build without leagues). */
export function useBoardSlot(): RenderBoardSlot | null {
  return useContext(SlotContext);
}

/** finish.js `tagged`: the tag at the end of the share's first line, after a space. */
export function tagged(text: string, tag: string): string {
  if (!tag) return text;
  const i = text.indexOf('\n');
  return i < 0 ? `${text} ${tag}` : `${text.slice(0, i)} ${tag}${text.slice(i)}`;
}
