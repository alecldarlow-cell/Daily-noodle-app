/**
 * The Mini, native. `enabled` turns it on in the play route. On since 25 Oct 2026:
 * `node scripts/replay.js --type mini --all` passed on every Mini with data (761
 * pages, 3044 runs, 144,956 moves compared, all identical to engines/mini.js).
 */
export const enabled = true;

export { MiniScreen } from './components/MiniScreen';
export { validate, init, apply, status, finish, type MiniData, type Move } from './model';
export { moves, scenario, VARIANTS, type Variant } from './oracle';
