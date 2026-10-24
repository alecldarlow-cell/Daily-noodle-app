/**
 * A puzzle day is a London calendar day (Europe/London), never UTC.
 * WP1 replaces this with a line-for-line port of dn-core.js and a differential test.
 */
const LONDON = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function londonDay(instant: Date = new Date()): string {
  // en-CA formats a date as YYYY-MM-DD.
  return LONDON.format(instant);
}
