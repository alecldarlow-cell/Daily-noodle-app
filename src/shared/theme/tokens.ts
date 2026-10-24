/**
 * House colour tokens, copied from the site's front.css (dailynoodle, 24 Oct 2026)
 * so native screens match the web pages in both light and dark.
 */
export type Scheme = 'light' | 'dark';

export interface Tokens {
  canvas: string;
  paper: string;
  ink: string;
  muted: string;
  faint: string;
  hair: string;
  accent: string;
  accentSoft: string;
  play: string;
  onPlay: string;
  bad: string;
  startedInk: string;
}

const light: Tokens = {
  canvas: '#FCFCFB',
  paper: '#FFFFFF',
  ink: '#15171C',
  muted: '#5F636B',
  faint: '#6E737B',
  hair: '#E6E6E2',
  accent: '#0E7A4B',
  accentSoft: '#E4F4EB',
  play: '#FFD54A',
  onPlay: '#15171C',
  bad: '#B3261E',
  startedInk: '#7A5A00',
};

const dark: Tokens = {
  canvas: '#11131A',
  paper: '#1B1E29',
  ink: '#ECEEF4',
  muted: '#A6ABBD',
  faint: '#80869A',
  hair: '#2E3344',
  accent: '#4CC793',
  accentSoft: '#142C24',
  play: '#FFD54A',
  onPlay: '#15171C',
  bad: '#FF7A6E',
  startedInk: '#FFD54A',
};

/** Tokens for a colour scheme; anything other than 'dark' gets the light set, as the site does. */
export function tokensFor(scheme: string | null | undefined): Tokens {
  return scheme === 'dark' ? dark : light;
}
