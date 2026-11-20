/**
 * Cryptic, native (Lab trial, from 21 Nov 2026; Alec, 20 Nov: Redact retired, Cryptic in its
 * slot). Its rules are a line-by-line port of engines/cryptic.js; the unit tests play every
 * page's data from the site (tests/fixtures) to its answer, as the page does.
 */
export const enabled = true;

export { CrypticScreen } from './components/CrypticScreen';
export { validate, init, apply, type CrypticData, type Move } from './model';
