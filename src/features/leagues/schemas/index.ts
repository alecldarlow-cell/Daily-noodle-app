/**
 * Form checks, mirroring the server's (board.clean, league_of, board_pin_set): text is
 * tidied as the server tidies it (spaces collapsed, ends trimmed), then held to the same
 * lengths and characters. The server still decides (and also checks its blocklist).
 */
import { object, string } from 'yup';

import { MESSAGES } from '../api/errors';

/** As board.clean: runs of whitespace become one space, ends trimmed. */
export const tidy = (s: unknown) =>
  String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim();

/** [[:alnum:]] then letters, numbers, spaces and ' ’ . _ - */
const CLEAN = /^[\p{L}\p{N}][\p{L}\p{N} '’._-]*$/u;

const cleanText = (min: number, max: number, msg: string) =>
  string()
    .transform(tidy)
    .required(msg)
    .min(min, msg)
    .max(max, msg)
    .matches(CLEAN, { message: msg, excludeEmptyString: true });

export const nicknameSchema = cleanText(2, 16, MESSAGES.bad_nick!);
export const leagueNameSchema = cleanText(2, 30, MESSAGES.bad_name!);

/**
 * A league code, typed or inside an invite link (`…/board.html?join=<code>`), as board.html
 * reads `?join=`: upper case, letters and numbers only, at most 12.
 */
export function codeFrom(input: unknown): string {
  const s = String(input ?? '').trim();
  const m = /(?:[?&]join=|join\.html\?(?:[^#\s]*&)?c=)([^&#\s]*)/i.exec(s);
  let raw = m ? m[1]! : s;
  try {
    raw = decodeURIComponent(raw);
  } catch {
    /* keep it as typed */
  }
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
}

const CODE_MSG = 'Enter the league’s code, or paste its invite link.';
export const codeSchema = string()
  .transform(codeFrom)
  .required(CODE_MSG)
  .matches(/^[A-Z0-9]{4,12}$/, CODE_MSG);

/** A PIN is exactly four numbers. */
export const pinSchema = string()
  .transform((s: unknown) => String(s ?? '').trim())
  .required(MESSAGES.bad_pin_format!)
  .matches(/^[0-9]{4}$/, MESSAGES.bad_pin_format!);

/** The optional PIN on the start and join forms: blank, or four numbers. */
export const optionalPinSchema = string()
  .transform((s: unknown) => String(s ?? '').trim())
  .matches(/^[0-9]{4}$/, { message: MESSAGES.bad_pin_format!, excludeEmptyString: true });

export const startSchema = object({
  name: leagueNameSchema,
  nick: nicknameSchema,
  pin: optionalPinSchema,
});

export const joinSchema = object({
  code: codeSchema,
  nick: nicknameSchema,
  pin: optionalPinSchema,
});

/** Claim: the PIN may be blank when the owner has let the player back in. */
export const claimSchema = object({
  code: codeSchema,
  nick: string().transform(tidy).required(MESSAGES.no_player!),
  pin: optionalPinSchema,
});

/** First error message of a schema on some values, or null when they pass. */
export function firstError(
  schema: { validateSync(v: unknown): unknown },
  values: unknown,
): string | null {
  try {
    schema.validateSync(values);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/** The values a schema keeps (tidied), once they pass. */
export function cleaned<T>(schema: { cast(v: unknown): unknown }, values: unknown): T {
  return schema.cast(values) as T;
}
