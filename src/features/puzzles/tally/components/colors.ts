/** Tally's own colours (engines/tally.css): the pale tints and the blue of the signs. */
export interface TallyColors {
  cell: string;
  peer: string;
  cage: string;
  lineSoft: string;
  sign: string;
  same: string;
}

const light: TallyColors = {
  cell: '#FFFFFF',
  peer: '#F3F5FA',
  cage: '#E9EDFB',
  lineSoft: '#D3D6E0',
  sign: '#1B3B9E',
  same: '#2E5BFF',
};
const dark: TallyColors = {
  cell: '#1E2230',
  peer: '#242939',
  cage: '#2A3250',
  lineSoft: '#3A3F52',
  sign: '#8EA6FF',
  same: '#8EA6FF',
};

export const tallyColors = (isDark: boolean) => (isDark ? dark : light);

/** The selected square stays yellow in dark mode, so what sits on it keeps dark ink. */
export const ON_YELLOW = { ink: '#141726', sign: '#1B3B9E', bad: '#A81E14', good: '#0B6B46' };
