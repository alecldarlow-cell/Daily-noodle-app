// Fixed English names, so dates read the same on every phone and in tests (Intl's
// en-GB data differs between engines: "Sep" in some, "Sept" in others). The site's
// engines write "Sep" (dnSweepDay).
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const at = (day: string) => new Date(`${day}T12:00:00Z`);

/**
 * A card's date as the site's front.js `relTime` writes it: "Today", "Yesterday",
 * "3d ago" within the week, then "18 Oct 2026".
 */
export function relDay(day: string, today: string): string {
  const d = at(day);
  if (Number.isNaN(d.getTime())) return '';
  const days = Math.round((at(today).getTime() - d.getTime()) / 864e5);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "Saturday 24 October" for a YYYY-MM-DD day, as the start card and finish sheet write it. */
export function longDate(day: string): string {
  const d = at(day);
  if (Number.isNaN(d.getTime())) return day;
  return `${DAYS_LONG[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS_LONG[d.getUTCMonth()]}`;
}

/** "Sat 24 Oct" for a YYYY-MM-DD day. */
export function shortDate(day: string): string {
  const d = at(day);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "October 2026" for a YYYY-MM-DD day. */
export function monthLabel(day: string): string {
  const d = at(day);
  return `${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * A heading that names the puzzle's day: "Today’s Mini" on today's, "Yesterday’s Mini" on
 * yesterday's, and `older` on anything earlier (an archive puzzle is not today's).
 */
export function dayHead(
  noun: string,
  day: string,
  today: string,
  older = 'From the archive',
): string {
  const d = at(day);
  const days = Math.round((at(today).getTime() - d.getTime()) / 864e5);
  if (Number.isNaN(days) || days <= 0) return `Today’s ${noun}`;
  if (days === 1) return `Yesterday’s ${noun}`;
  return older;
}
