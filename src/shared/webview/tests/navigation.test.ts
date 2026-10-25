import { decide, pageUrl, typeOfFile } from '../navigation';

const CUR = '2026-10-24-crossword-mini-0105';
const S = 'https://dailynoodle.co.uk';

describe('GIVEN the page wants to navigate', () => {
  it('THEN its own page and assets load', () => {
    expect(decide(`${S}/reports/${CUR}.html?via=app`, CUR)).toEqual({ kind: 'allow' });
    expect(decide(`${S}/engines/mini.js`, CUR)).toEqual({ kind: 'allow' });
    expect(decide('about:blank', CUR)).toEqual({ kind: 'allow' });
    expect(decide('not a url', CUR)).toEqual({ kind: 'allow' });
  });
  it('THEN the guide and privacy page open in place', () => {
    expect(decide(`${S}/how-to-play.html#mini`, CUR)).toEqual({ kind: 'allow' });
    expect(decide(`${S}/privacy.html`, CUR)).toEqual({ kind: 'allow' });
  });
  it('THEN "← Puzzles" and the home page go back to the app', () => {
    for (const p of ['/puzzles.html', '/', '/index.html'])
      expect(decide(`${S}${p}`, CUR)).toEqual({ kind: 'back' });
  });
  it('THEN the Next row opens that puzzle in the app', () => {
    expect(decide(`${S}/reports/2026-10-24-logic-doku-0103.html`, CUR)).toEqual({
      kind: 'play',
      type: 'doku',
      file: '2026-10-24-logic-doku-0103',
    });
  });
  it('THEN other sites and other pages go to the browser', () => {
    expect(decide('https://example.com/', CUR)).toEqual({ kind: 'external' });
    expect(decide(`${S}/games.html`, CUR)).toEqual({ kind: 'external' });
    expect(decide(`${S}/reports/2026-10-24-arcade-bubble-burst.html`, CUR)).toEqual({
      kind: 'external',
    });
  });
});

describe('GIVEN puzzle file names', () => {
  it.each([
    ['2026-10-24-crossword-mini-0105', 'mini'],
    ['2026-10-24-logic-doku-0103', 'doku'],
    ['2026-10-24-logic-sweep', 'sweep'],
    ['DP-SWEEP-2026-07-17', 'sweep'],
    ['2026-10-24-logic-path-0098', 'path'],
    ['digi-path-0002', 'path'],
    ['digi-doku-0004', 'doku'],
    ['2026-10-24-word-link-0077', 'link'],
    ['2026-10-24-word-tangle-0018', 'tangle'],
    ['2026-10-24-geo-borders-0020', 'borders'],
    ['2026-10-24-quiz-reckon-0005', 'reckon'],
    ['2026-10-24-briefing', null],
  ])('THEN %s is a %s', (file, type) => {
    expect(typeOfFile(file)).toBe(type);
  });
  it('THEN the page address is tagged as the app', () => {
    expect(pageUrl(CUR)).toBe(`${S}/reports/${CUR}.html?via=app`);
  });
});
