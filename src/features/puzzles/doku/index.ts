/**
 * The Doku, native. `enabled` turns it on in the play route, once
 * `node scripts/replay.js --type doku --all` has passed on every Doku with data.
 */
export const enabled = false;

export { DokuScreen } from './components/DokuScreen';
export { validate, init, apply, status, finish, type DokuData, type Move } from './model';
export { moves, scenario, VARIANTS, type Variant } from './oracle';
