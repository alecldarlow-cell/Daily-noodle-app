import appJson from '../../app.json';

declare const __dirname: string;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { readFileSync } = require('fs') as { readFileSync: (p: string) => Uint8Array };

/** A PNG's size and colour type, from its IHDR chunk (2: RGB, 6: RGB with alpha). */
function png(rel: string) {
  const b = readFileSync(`${__dirname}/../../${rel.replace(/^\.\//, '')}`);
  expect(String.fromCharCode(...b.subarray(1, 4))).toBe('PNG');
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { w: v.getUint32(16), h: v.getUint32(20), colour: b[25] };
}

describe('GIVEN the app icon', () => {
  describe('WHEN Android draws it as an adaptive icon', () => {
    it('THEN the letters sit on a clear layer over the house blue, with a themed-icon version', () => {
      const a = appJson.expo.android.adaptiveIcon;
      expect(a.backgroundColor).toBe('#1C46C2');
      for (const f of [a.foregroundImage, a.monochromeImage])
        expect(png(f)).toEqual({ w: 1024, h: 1024, colour: 6 });
    });
  });

  describe('WHEN iOS and the Play listing use it', () => {
    it('THEN iOS gets an opaque 1024 square and Play a 512 one', () => {
      expect(appJson.expo.icon).toBe('./assets/images/icon.png');
      expect(png('assets/images/icon.png')).toEqual({ w: 1024, h: 1024, colour: 2 });
      expect(png('assets/images/play-store-icon.png')).toEqual({ w: 512, h: 512, colour: 2 });
    });
  });
});
