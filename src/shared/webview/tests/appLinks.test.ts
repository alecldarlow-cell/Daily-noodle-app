import app from '../../../../app.json';

const TYPES = ['mini', 'doku', 'sweep', 'path', 'link', 'tangle', 'borders', 'reckon'];
const HOST = { scheme: 'https', host: 'dailynoodle.co.uk' };

// The Android App Links the site's .well-known/assetlinks.json verifies (SITE.md › App links;
// assetlinks.json is per domain, so new paths need no site change).
describe('GIVEN the app config', () => {
  describe('WHEN Android decides which links the app opens', () => {
    it('THEN the site’s join.html invites, verified', () => {
      expect(app.expo.android.intentFilters[0]).toEqual({
        action: 'VIEW',
        autoVerify: true,
        data: [{ ...HOST, pathPrefix: '/join.html' }],
        category: ['BROWSABLE', 'DEFAULT'],
      });
    });

    it('THEN a shared result’s short link for each type, in each form the site serves (AF-010)', () => {
      expect(app.expo.android.intentFilters[1]).toEqual({
        action: 'VIEW',
        autoVerify: true,
        data: TYPES.flatMap((t) => [
          { ...HOST, path: `/${t}` },
          { ...HOST, path: `/${t}/` },
          { ...HOST, path: `/${t}/index.html` },
        ]),
        category: ['BROWSABLE', 'DEFAULT'],
      });
    });

    it('THEN nothing else: board.html stays in the browser, as the website’s sign-in emails land there', () => {
      expect(app.expo.android.intentFilters).toHaveLength(2);
      expect(JSON.stringify(app.expo.android.intentFilters)).not.toContain('board');
    });

    it('THEN the dailynoodle:// scheme stays for the sign-in link', () => {
      expect(app.expo.scheme).toBe('dailynoodle');
    });
  });
});
