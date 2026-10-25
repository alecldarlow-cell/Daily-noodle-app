/**
 * The site's typefaces, bundled from Google Fonts as static weights (OFL, licences beside
 * the files in assets/fonts): front.css's `--display` Archivo and `--body` Inter for the
 * lists, and the players' pair (house.css, finish.css): Archivo for the interface and
 * Instrument Serif for the big moments (the puzzle's name, the result, the stats).
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
  /** The players' interface text (Archivo 400). */
  sans: 'Archivo-Regular',
  /** Share lines, labels (Archivo 500). */
  sansMedium: 'Archivo-Medium',
  /** Names, buttons, the clock (Archivo 600). */
  sansSemi: 'Archivo-SemiBold',
  /** Titles, results, stats (Instrument Serif). */
  serif: 'InstrumentSerif-Regular',
  /** Kickers and dates (Instrument Serif italic). */
  serifItalic: 'InstrumentSerif-Italic',
} as const;

/** For expo-font's `useFonts`, keyed by the family names above. */
export const FONT_FILES = {
  [FONT.display]: require('../../../assets/fonts/Archivo-Bold.ttf') as number,
  [FONT.displayHeavy]: require('../../../assets/fonts/Archivo-ExtraBold.ttf') as number,
  [FONT.body]: require('../../../assets/fonts/Inter-Regular.ttf') as number,
  [FONT.bodySemi]: require('../../../assets/fonts/Inter-SemiBold.ttf') as number,
  [FONT.bodyBold]: require('../../../assets/fonts/Inter-Bold.ttf') as number,
  [FONT.sans]: require('../../../assets/fonts/Archivo-Regular.ttf') as number,
  [FONT.sansMedium]: require('../../../assets/fonts/Archivo-Medium.ttf') as number,
  [FONT.sansSemi]: require('../../../assets/fonts/Archivo-SemiBold.ttf') as number,
  [FONT.serif]: require('../../../assets/fonts/InstrumentSerif-Regular.ttf') as number,
  [FONT.serifItalic]: require('../../../assets/fonts/InstrumentSerif-Italic.ttf') as number,
};
