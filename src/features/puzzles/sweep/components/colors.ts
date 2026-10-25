/** Sweep's own colours from dailynoodle engines/sweep.css and house.css (numbers, hidden squares). */
export interface SweepColors {
  hidden: string;
  locked: string;
  flag: string;
  why: string;
  /** The colour of each number, 1 to 5 (6 and up in ink). */
  n: Record<number, string>;
}

const light: SweepColors = {
  hidden: '#DDE1EA',
  locked: '#CBD0DC',
  flag: '#2E5BFF',
  why: '#2E5BFF',
  n: { 1: '#2E5BFF', 2: '#1F9E6B', 3: '#E4483B', 4: '#1B3B9E', 5: '#9A6B00' },
};

const dark: SweepColors = {
  hidden: '#4A5068',
  locked: '#444A60',
  flag: '#1B3B9E',
  why: '#A9BBFF',
  n: { 1: '#8EA6FF', 2: '#4CC793', 3: '#FF7A6E', 4: '#C9D3FF', 5: '#E0A92E' },
};

export const sweepColors = (isDark: boolean) => (isDark ? dark : light);
