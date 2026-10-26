import app from '../../../../app.json';

// The Android App Link the site's .well-known/assetlinks.json verifies (SITE.md › App links).
// Only join.html: board.html also carries the website's sign-in links (#access_token=), which
// must stay in the browser.
describe('GIVEN the app config', () => {
  describe('WHEN Android decides which links the app opens', () => {
    it('THEN it is exactly the site’s join.html, verified', () => {
      expect(app.expo.android.intentFilters).toEqual([
        {
          action: 'VIEW',
          autoVerify: true,
          data: [{ scheme: 'https', host: 'dailynoodle.co.uk', pathPrefix: '/join.html' }],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ]);
    });
    it('THEN the dailynoodle:// scheme stays for the sign-in link', () => {
      expect(app.expo.scheme).toBe('dailynoodle');
    });
  });
});
