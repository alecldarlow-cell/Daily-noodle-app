/**
 * Tilt, native (Lab, 11 Nov 2026). `enabled` turns it on in the play route, once
 * `node scripts/replay.js --type tilt --all` was identical to engines/tilt.js on every page.
 */
export const enabled = true;

export { TiltScreen } from './components/TiltScreen';
export { validate, init, apply, type TiltData, type Move } from './model';
export { moves, scenario, VARIANTS, type Variant } from './oracle';
