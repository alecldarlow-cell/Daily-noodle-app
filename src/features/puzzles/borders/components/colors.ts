/**
 * Borders' own palette (dailynoodle engines/borders.css: the atlas, and its "atlas at
 * night" dark), so the native player looks like the page.
 */
import { useColorScheme } from 'react-native';

export interface BordersColors {
  bg: string;
  sea: string;
  grat: string;
  ink: string;
  ink2: string;
  paper: string;
  pin: string;
  ok: string;
  okT: string;
  pinT: string;
  edge: string;
  globe: string;
  wland: string;
  landEdge: string;
  onRight: string;
  onWrong: string;
  veil: string;
  line: string;
}

const light: BordersColors = {
  bg: '#E3ECE8',
  sea: '#CFE6E8',
  grat: '#A9D0D5',
  ink: '#1F3A4A',
  ink2: '#4E6673',
  paper: '#FAFBF7',
  pin: '#C2453D',
  ok: '#2E7A50',
  okT: '#D2EAD9',
  pinT: '#F4D6D1',
  edge: '#1F3A4A',
  globe: '#E4F1F1',
  wland: '#E9DCAE',
  landEdge: '#1F3A4A',
  onRight: '#173F2A',
  onWrong: '#5E1E18',
  veil: 'rgba(207,230,232,0.92)',
  line: 'rgba(31,58,74,0.16)',
};

const dark: BordersColors = {
  bg: '#0F181D',
  sea: '#16303A',
  grat: '#2A4C57',
  ink: '#DCE8EC',
  ink2: '#97ADB6',
  paper: '#1B2A31',
  pin: '#FF7A6E',
  ok: '#4CC793',
  okT: '#173A2A',
  pinT: '#4A2522',
  edge: '#4C6772',
  globe: '#1E3A44',
  wland: '#BBAE80',
  landEdge: '#0B1418',
  onRight: '#C4F0D5',
  onWrong: '#FFD6D0',
  veil: 'rgba(22,48,58,0.92)',
  line: 'rgba(220,232,236,0.14)',
};

export function useBordersColors(): BordersColors {
  return useColorScheme() === 'dark' ? dark : light;
}
