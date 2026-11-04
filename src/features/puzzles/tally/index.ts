/**
 * Tally, native. `enabled` turns it on in the play route. On since 4 Nov 2026: Alec's rule
 * for a new type (a sample of today and the next three days, the full replay overnight);
 * `node scripts/replay.js --type tally` on those days was identical to engines/tally.js.
 */
export const enabled = true;

export { TallyScreen } from './components/TallyScreen';
export { validate, init, apply, type TallyData, type Move } from './model';
export { moves, scenario, VARIANTS, type Variant } from './oracle';
