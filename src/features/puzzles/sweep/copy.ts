/**
 * What the screen shows for the model's replay words on a past day's puzzle. Display
 * only: the model keeps the page's words (`msg`, `rank`), which the differential replay
 * checks, and what is recorded is unchanged.
 *
 * The page decides "replay" from today's date alone (initRanked: today already has a
 * Sweep result), so an old Sweep opened from the archive after today's was played says
 * "Today's result is already in — this is a replay", and "· replay", though it has never
 * been played. What is true there is that it won't touch the streak (`ranked` is false,
 * so nothing goes into it), so that is what the screen says. A real replay (Play again
 * after a mine) keeps the page's words.
 */
import { LOSS_REPLAY_MSG, REPLAY_MSG, type SweepState } from './model';

export const PAST_MSG = "A past puzzle — this one won't change your streak.";

const WIN_REPLAY = ' Replay — nothing recorded.';

export function shownCopy(
  s: Pick<SweepState, 'msg' | 'rank' | 'ranked' | 'replayStarted'>,
  past: boolean,
): { msg: string; rank: string } {
  if (!past || s.ranked || s.replayStarted) return { msg: s.msg, rank: s.rank };
  let msg = s.msg;
  if (msg === REPLAY_MSG) msg = PAST_MSG;
  else if (msg === LOSS_REPLAY_MSG) msg = `That was a mine. ${PAST_MSG}`;
  else if (msg.endsWith(WIN_REPLAY)) msg = `${msg.slice(0, -WIN_REPLAY.length)} ${PAST_MSG}`;
  return { msg, rank: '' };
}
