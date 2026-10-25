/**
 * The site's two typefaces (front.css: `--display` Archivo, `--body` Inter), bundled from
 * Google Fonts as static weights (OFL, licences beside the files in assets/fonts).
 *
 * Use one family per weight and leave `fontWeight` unset: Android picks a custom font by
 * family name, and a weight on top can make it fall back to the system font. Until the
 * fonts load, or if they never do, text shows in the system font rather than not at all.
 */
export const FONT = {
  /** Headlines, the wordmark, the masthead kicker (Archivo 700). */
  display: 'Archivo-Bold',
  /** The monogram and heaviest display text (Archivo 800). */
  displayHeavy: 'Archivo-ExtraBold',
  /** Body copy, standfirsts (Inter 400). */
  body: 'Inter-Regular',
  /** Meta lines, chips, counts (Inter 600). */
  bodySemi: 'Inter-SemiBold',
  /** Results, emphasis (Inter 700). */
  bodyBold: 'Inter-Bold',
} as const;

/** For expo-font's `useFonts`, keyed by the family names above. */
export const FONT_FILES = {
  [FONT.display]: require('../../../assets/fonts/Archivo-Bold.ttf') as number,
  [FONT.displayHeavy]: require('../../../assets/fonts/Archivo-ExtraBold.ttf') as number,
  [FONT.body]: require('../../../assets/fonts/Inter-Regular.ttf') as number,
  [FONT.bodySemi]: require('../../../assets/fonts/Inter-SemiBold.ttf') as number,
  [FONT.bodyBold]: require('../../../assets/fonts/Inter-Bold.ttf') as number,
};
