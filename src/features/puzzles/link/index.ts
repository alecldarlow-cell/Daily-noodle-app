/**
 * Link, native. `enabled` turns it on in the play route. On since 25 Oct 2026:
 * `node scripts/replay.js --type link --all` passed on every Link with data (347
 * pages, 2082 runs, 72,870 moves compared, all identical to engines/link.js; one
 * site bug on the sheet after Play again reported as KNOWN, see replay-link.js).
 */
export const enabled = true;

export { LinkScreen } from './components/LinkScreen';
export { validate, init, apply, type LinkData, type Move } from './model';
export { moves, scenario, VARIANTS, type Variant } from './oracle';
