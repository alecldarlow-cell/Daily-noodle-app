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
