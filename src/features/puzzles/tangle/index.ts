/**
 * Tangle, native. `enabled` turns it on in the play route, only once
 * `node scripts/replay.js --type tangle --all` is identical on every Tangle with data.
 */
export const enabled = false;

export { TangleScreen } from './components/TangleScreen';
export { validate, createTangle, type TangleData } from './model';
export { moves, scenario, VARIANTS, type Variant } from './oracle';
