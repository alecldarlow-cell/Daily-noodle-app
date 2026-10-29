/** AF-013: the pure rules that turn a game's change into the website's tones. */
import { bordersSound, type BordersSoundSnap } from '../borders/hooks/sound';
import { reckonSound, type ReckonSoundSnap } from '../reckon/hooks/sound';
import { tangleSound, type TangleSoundSnap } from '../tangle/hooks/sound';

const toast = { text: '', cls: '' };
const tg = (o: Partial<TangleSoundSnap> = {}): TangleSoundSnap => ({
  play: true,
  pathLen: 0,
  pathFirst: -1,
  found: 0,
  lastLen: 0,
  star: false,
  toast,
  count: '',
  secs: 60,
  round: 'playing',
  ...o,
});

describe('GIVEN Tangle’s rule', () => {
  describe('WHEN a round is resumed with words already found', () => {
    it('THEN no word chime plays (only the count-in’s first beat)', () => {
      expect(tangleSound(tg({ play: false }), tg({ found: 5, lastLen: 6, count: '3' }))).toEqual([
        'tangle-tick',
      ]);
    });
  });
  describe('WHEN the path steps back to an earlier letter or undoes one', () => {
    it('THEN it is silent, as the page', () => {
      expect(
        tangleSound(tg({ pathLen: 4, pathFirst: 2 }), tg({ pathLen: 2, pathFirst: 2 })),
      ).toEqual([]);
    });
  });
  describe('WHEN a tap starts a new word elsewhere', () => {
    it('THEN its first step plays', () => {
      expect(
        tangleSound(tg({ pathLen: 3, pathFirst: 2 }), tg({ pathLen: 1, pathFirst: 7 })),
      ).toEqual(['tangle-step-1']);
    });
  });
  describe('WHEN a path runs past twelve letters, or a word past eight', () => {
    it('THEN the step and the chime stop rising, as the page caps them', () => {
      expect(
        tangleSound(tg({ pathLen: 12, pathFirst: 0 }), tg({ pathLen: 13, pathFirst: 0 })),
      ).toEqual(['tangle-step-12']);
      expect(tangleSound(tg(), tg({ found: 1, lastLen: 10 }))).toEqual(['tangle-word-8']);
    });
  });
  describe('WHEN "Already found" shows, or a toast just fades', () => {
    it('THEN nothing plays', () => {
      const shown = { text: 'Too short', cls: 'on' };
      expect(tangleSound(tg(), tg({ toast: { text: 'Already found', cls: 'on' } }))).toEqual([]);
      expect(tangleSound(tg({ toast: shown }), tg({ toast: { ...shown, cls: '' } }))).toEqual([]);
    });
  });
  describe('WHEN the clock passes six seconds, or is paused', () => {
    it('THEN no tick', () => {
      expect(tangleSound(tg({ secs: 7 }), tg({ secs: 6 }))).toEqual([]);
      expect(tangleSound(tg({ secs: 4 }), tg({ secs: null }))).toEqual([]);
    });
  });
});

const bd = (o: Partial<BordersSoundSnap> = {}): BordersSoundSnap => ({
  quiz: true,
  answered: 0,
  lastOk: false,
  q: 0,
  hint: false,
  ...o,
});

describe('GIVEN Borders’ rule', () => {
  it('THEN resuming a round with answers and a hint used is silent', () => {
    expect(
      bordersSound(bd({ quiz: false }), bd({ answered: 4, lastOk: true, q: 4, hint: true })),
    ).toEqual([]);
  });
  it('THEN a new question with Show on map unused is silent', () => {
    expect(bordersSound(bd({ q: 1, hint: true, answered: 2 }), bd({ q: 2, answered: 2 }))).toEqual(
      [],
    );
  });
});

const rk = (o: Partial<ReckonSoundSnap> = {}): ReckonSoundSnap => ({
  play: true,
  locked: 0,
  zone: 4,
  q: 0,
  ci: 10,
  ...o,
});

describe('GIVEN Reckon’s rule', () => {
  it('THEN resuming a round is silent', () => {
    expect(reckonSound(rk({ play: false }), rk({ locked: 3, zone: 0, q: 3, ci: 4 }))).toEqual([]);
  });
  it('THEN moving to another question moves the slider silently', () => {
    expect(reckonSound(rk({ q: 0, ci: 10 }), rk({ q: 1, ci: 22 }))).toEqual([]);
  });
  it('THEN Lock in plays its zone with the lock', () => {
    expect(reckonSound(rk(), rk({ locked: 1, zone: 2 }))).toEqual(['reckon-lock-2']);
  });
});
