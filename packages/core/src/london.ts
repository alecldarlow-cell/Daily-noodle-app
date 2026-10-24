/**
 * London calendar days. Ported line for line from dailynoodle `dn-core.js`
 * (`londonDay`, `dayBefore`). A puzzle day is a London day, never UTC.
 */
const LONDON = (() => {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return null;
  }
})();

/** The London day (YYYY-MM-DD) of an instant; now when none is given. */
export function londonDay(instant?: Date | number | string): string {
  const d = instant === undefined ? new Date() : new Date(instant);
  if (LONDON) {
    const p: Record<string, string> = {};
    for (const x of LONDON.formatToParts(d)) p[x.type] = x.value;
    return `${p.year}-${p.month}-${p.day}`;
  }
  // As dn-core.js: without Intl time zones, fall back to the UTC day.
  return d.toISOString().slice(0, 10);
}

/** The calendar day before a YYYY-MM-DD day. */
export function dayBefore(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** True for a well-formed YYYY-MM-DD string. */
export function isDay(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
