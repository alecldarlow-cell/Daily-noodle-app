/**
 * Path, native. `enabled` turns it on in the play route, only once
 * `node scripts/replay.js --type path --all` passes on every Path with data.
 */
export const enabled = false;

export { PathScreen } from './components/PathScreen';
export { validate, init, apply, finish, type PathData, type Move } from './model';
export { moves, scenario, VARIANTS, type Variant } from './oracle';
