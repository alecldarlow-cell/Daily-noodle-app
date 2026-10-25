/**
 * Reckon's own palette (dailynoodle engines/reckon.css: Ballpark's colours, warm dark),
 * light and dark, so the native player looks like the page.
 */
import { useColorScheme } from 'react-native';

export interface ReckonColors {
  bg: string;
  paper: string;
  ink: string;
  ink2: string;
  line: string;
  rule: string;
  tom: string;
  onTom: string;
  knob: string;
  veil: string;
  tipBg: string;
  tipInk: string;
  /** Bullseye, Close, Ballpark, In range, Miss. */
  zones: [string, string, string, string, string];
  onZ: string;
}

const light: ReckonColors = {
  bg: '#F5EFE4',
  paper: '#FFFCF6',
  ink: '#1E2433',
  ink2: '#5E5B55',
  line: '#E4DACA',
  rule: '#CBBDA6',
  tom: '#CF472F',
  onTom: '#FFFFFF',
  knob: '#FFFFFF',
  veil: 'rgba(30,36,51,0.45)',
  tipBg: '#1E2433',
  tipInk: '#FFFCF6',
  zones: ['#1E9E6A', '#86BD4B', '#F0B43C', '#F08C50', '#B1A99C'],
  onZ: '#1E2433',
};

const dark: ReckonColors = {
  bg: '#16140F',
  paper: '#24211B',
  ink: '#F1EBDF',
  ink2: '#ABA497',
  line: '#3A352D',
  rule: '#544D42',
  tom: '#E8664D',
  onTom: '#16140F',
  knob: '#F1EBDF',
  veil: 'rgba(5,4,3,0.6)',
  tipBg: '#F1EBDF',
  tipInk: '#16140F',
  zones: ['#2FB57F', '#97CB5E', '#F2BF4E', '#F49A62', '#8E877A'],
  onZ: '#16140F',
};

export function useReckonColors(): ReckonColors {
  return useColorScheme() === 'dark' ? dark : light;
}
