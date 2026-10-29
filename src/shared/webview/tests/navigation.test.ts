import { decide, pageUrl, systemPath, typeOfFile } from '../navigation';

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

describe('GIVEN an invite link to join.html (SITE.md › App links)', () => {
  describe('WHEN a page inside the app links to it', () => {
    it('THEN the Leagues tab opens that invite, as board.html?join= does', () => {
      expect(decide(`${S}/join.html?c=ABCD2345`, CUR)).toEqual({
        kind: 'leagues',
        params: { join: 'ABCD2345' },
      });
      expect(decide(`${S}/join.html`, CUR)).toEqual({ kind: 'leagues', params: {} });
    });
  });

  describe('WHEN the phone opens it in the app (an Android App Link)', () => {
    it('THEN it goes to that league’s invite, the code tidied', () => {
      expect(systemPath(`${S}/join.html?c=ABCD2345`)).toBe('/leagues?join=ABCD2345');
      expect(systemPath(`${S}/join.html?c=abcd-2345&x=1`)).toBe('/leagues?join=ABCD2345');
      // expo-router may hand over the path alone.
      expect(systemPath('/join.html?c=WXYZ2345')).toBe('/leagues?join=WXYZ2345');
    });
    it('THEN a missing or broken code opens Leagues', () => {
      expect(systemPath(`${S}/join.html`)).toBe('/leagues');
      expect(systemPath(`${S}/join.html?c=AB`)).toBe('/leagues');
      expect(systemPath(`${S}/join.html?c=${'A'.repeat(13)}`)).toBe('/leagues');
    });
  });

  describe('WHEN any other link reaches the app', () => {
    it('THEN it is left to the router unchanged', () => {
      for (const path of [
        'dailynoodle://auth#access_token=x&refresh_token=y',
        'dailynoodle://leagues?join=ABCD2345',
        '/leagues?go=claim',
        `${S}/board.html`,
        `${S}/board.html?p=mini&d=2026-10-24`,
        `${S}/board.html#access_token=x`,
        `${S}/board.html?join=ABCD2345#access_token=x&refresh_token=y`,
        `${S}/board.html?code=abc123&join=ABCD2345`,
        `${S}/board.html?join=ABCD2345#dnmove=xyz`,
        `${S}/games.html`,
        `${S}/minis`,
        `${S}/mini/extra`,
        'https://example.com/join.html?c=ABCD2345',
        'https://example.com/mini',
        'http://[broken',
      ])
        expect(systemPath(path)).toBe(path);
    });
  });
});

describe('GIVEN a shared link to a league board (board.html?join=CODE, AF-010)', () => {
  describe('WHEN it reaches the app', () => {
    it('THEN it opens that league’s invite, as join.html does', () => {
      expect(systemPath(`${S}/board.html?join=ABCD2345`)).toBe('/leagues?join=ABCD2345');
      expect(systemPath(`${S}/board.html?join=abcd-2345&v=2`)).toBe('/leagues?join=ABCD2345');
      expect(systemPath('/board.html?join=WXYZ2345')).toBe('/leagues?join=WXYZ2345');
    });
    it('THEN a broken code is left alone', () => {
      expect(systemPath(`${S}/board.html?join=AB`)).toBe(`${S}/board.html?join=AB`);
    });
  });
});

describe('GIVEN a shared result’s short link (dailynoodle.co.uk/<type>, AF-010)', () => {
  const TYPES = ['mini', 'doku', 'sweep', 'path', 'link', 'tangle', 'borders', 'reckon'];
  describe('WHEN it reaches the app, in any form the site serves', () => {
    it('THEN Today opens on today’s puzzle of that type', () => {
      for (const t of TYPES) {
        expect(systemPath(`${S}/${t}`)).toBe(`/?open=${t}`);
        expect(systemPath(`${S}/${t}/`)).toBe(`/?open=${t}`);
        expect(systemPath(`${S}/${t}/index.html?via=share`)).toBe(`/?open=${t}`);
        expect(systemPath(`/${t}`)).toBe(`/?open=${t}`);
      }
    });
  });
});
