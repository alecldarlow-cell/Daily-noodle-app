/**
 * Tangle, native. `enabled` turns it on in the play route. On since 25 Oct 2026:
 * `node scripts/replay.js --type tangle --all` passed on every Tangle with data (671
 * pages, 3355 runs, 70,455 moves compared, all identical to engines/tangle.js).
 */
export const enabled = true;

export { TangleScreen } from './components/TangleScreen';
export { validate, createTangle, type TangleData } from './model';
export { moves, scenario, VARIANTS, type Variant } from './oracle';
