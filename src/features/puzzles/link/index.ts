/**
 * Link, native. `enabled` turns it on in the play route, only once
 * `node scripts/replay.js --type link --all` is identical on every Link with data.
 */
export const enabled = false;

export { LinkScreen } from './components/LinkScreen';
export { validate, init, apply, type LinkData, type Move } from './model';
export { moves, scenario, VARIANTS, type Variant } from './oracle';
