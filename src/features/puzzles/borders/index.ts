/**
 * Borders, native. `enabled` turns it on in the play route, once
 * `node scripts/replay.js --type borders --all` has passed on every Borders with data.
 */
export const enabled = false;

export { BordersScreen } from './components/BordersScreen';
export { validate, init, apply, frame, type BordersData, type Move } from './model';
export { moves, scenario, VARIANTS, type Variant } from './oracle';
