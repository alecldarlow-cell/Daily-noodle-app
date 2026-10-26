/**
 * Sign-in and sync failures in the house's words. Supabase's own text ("Email rate limit
 * exceeded", "For security purposes…", a fetch error) never reaches the player: it is
 * read for what kind of failure it was, and the player sees one of these lines.
 */
export const AUTH_WORDS = {
  rateLimit: 'Too many sign-in emails just now. Wait a minute, then try again.',
  badEmail: 'That doesn’t look like an email address.',
  expired: 'That sign-in link has expired or was already used.',
  offline: 'Couldn’t reach the server. Check your connection and try again.',
  wrong: 'Something went wrong. Please try again.',
} as const;

/** A failure already in the house's words (the email check, "not available in this build"). */
export class AccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountError';
  }
}

/** The house's line for a message from Supabase (or a failed request). */
export function authMessage(raw: string | null | undefined): string {
  const m = (raw ?? '').toLowerCase();
  if (/rate limit|too many|only request this after|security purposes/.test(m))
    return AUTH_WORDS.rateLimit;
  if (/network|fetch|timed? ?out|offline|connection/.test(m)) return AUTH_WORDS.offline;
  if (/expired|otp|(invalid|bad).*(link|token|grant|jwt|session)|access_denied/.test(m))
    return AUTH_WORDS.expired;
  if (/email/.test(m) && /invalid|valid|format/.test(m)) return AUTH_WORDS.badEmail;
  return AUTH_WORDS.wrong;
}

/** What to show for any failure: our own words as they are, anything else by its kind. */
export function sayAccountError(e: unknown): string {
  if (e instanceof AccountError) return e.message;
  return authMessage(e instanceof Error ? e.message : null);
}
