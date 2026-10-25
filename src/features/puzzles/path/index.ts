/**
 * Path, native. `enabled` turns it on in the play route. On since 25 Oct 2026:
 * `node scripts/replay.js --type path --all` passed on every Path with data (760
 * pages, 3,040 runs in four variants, 130,476 moves compared, all identical to
 * engines/path.js).
 */
export const enabled = true;

export { PathScreen } from './components/PathScreen';
export { validate, init, apply, finish, type PathData, type Move } from './model';
export { moves, scenario, VARIANTS, type Variant } from './oracle';
