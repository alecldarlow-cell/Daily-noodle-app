/**
 * The Mini, native. `enabled` turns it on in the play route; it is set true only
 * once `node scripts/replay.js --type mini --all` has passed on every Mini.
 */
export const enabled = false;

export { MiniScreen } from './components/MiniScreen';
export { validate, init, apply, status, finish, type MiniData, type Move } from './model';
export { moves, scenario, VARIANTS, type Variant } from './oracle';
