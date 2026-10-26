/** The server's reasons, in the site's words (dn-board.js MESSAGES). */
export const MESSAGES: Record<string, string> = {
  no_league: 'That league code doesn’t exist, or the league has closed.',
  nick_taken: 'Someone in that league already uses that nickname.',
  bad_nick: 'Nicknames are 2–16 letters or numbers.',
  bad_name: 'League names are 2–30 letters or numbers.',
  league_full: 'That league is full (50 players).',
  too_many_owned: 'You can run up to 3 leagues.',
  too_many_joined: 'You can be in up to 10 leagues.',
  not_member: 'You’re not in that league.',
  not_owner: 'Only the league’s owner can do that.',
  busy: 'Lots of new leagues right now — please try again later.',
  paused: 'New leagues are paused for now — please try again later.',
  already_member: 'You’re already in that league.',
  bad_pin_format: 'PINs are 4 numbers.',
  bad_pin: 'That PIN doesn’t match. Check the nickname and try again.',
  pin_locked:
    'Too many wrong PINs. Try again in an hour, or ask the league’s owner to tap “Let back in” next to your name.',
  no_pin:
    'There’s no PIN for that nickname yet. Ask the league’s owner to tap “Let back in” next to your name, then try again here.',
  no_player: 'Nobody in that league has that nickname.',
  // App only: a build made without the Supabase settings (.env.example).
  not_configured: 'Leagues aren’t available in this build.',
  // App only: the call never reached the server (no signal, or the request failed on the way).
  offline: 'Couldn’t reach the leagues. Check your connection and try again.',
};

export const SOMETHING_WRONG = 'Something went wrong. Please try again.';

/** A refused or failed board call: `code` is the server's reason, `message` the site's words. */
export class BoardError extends Error {
  constructor(readonly code: string) {
    super(MESSAGES[code] ?? SOMETHING_WRONG);
    this.name = 'BoardError';
  }
}

/** A failure already put in the house's words (a hint added to a reason, a bad paste). */
export class SaidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaidError';
  }
}

/**
 * What to show a player for a failure: the site's words for a board reason, our own
 * words for a SaidError, and never anything else's raw text (a library's or a server's).
 */
export function sayError(e: unknown): string {
  if ((e instanceof BoardError || e instanceof SaidError) && e.message) return e.message;
  return SOMETHING_WRONG;
}

/** True when a failure was the connection, not the server saying no. */
export const isOffline = (e: unknown): boolean => e instanceof BoardError && e.code === 'offline';
