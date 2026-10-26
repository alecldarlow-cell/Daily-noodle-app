/**
 * Path's thread colours. Light mode keeps the page's literals (path.js polyline: cobalt
 * from 1, deep blue from 36, green once complete). Dark mode uses the house's dark
 * stand-ins for the same two blues (house.css dark --n1 and --n4, as Sweep's numbers
 * use them) and the dark green, because the page's deep blue all but vanishes on the
 * dark card (about 1.3:1).
 */
export interface PathColors {
  low: string;
  high: string;
  done: string;
}

const light: PathColors = { low: '#2E5BFF', high: '#1B3B9E', done: '#1F9E6B' };
const dark: PathColors = { low: '#8EA6FF', high: '#C9D3FF', done: '#4CC793' };

export const pathColors = (isDark: boolean) => (isDark ? dark : light);
