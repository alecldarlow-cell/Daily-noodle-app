import type { ArchiveItem, FeedLite } from '../types';

const item = (
  o: Partial<ArchiveItem> & Pick<ArchiveItem, 'type' | 'id' | 'date' | 'headline'>,
): ArchiveItem => ({
  path: `reports/${o.date}-${o.type}-${o.id.split('·').pop()}.html`,
  standfirst: `${o.headline} clues.`,
  read: '~3 min',
  mask: '',
  json: null,
  ...o,
});

export const ITEMS: ArchiveItem[] = [
  item({ type: 'mini', id: 'DP·MINI·0105', date: '2026-10-24', headline: 'Mini 105' }),
  item({ type: 'mini', id: 'DP·MINI·0010', date: '2026-07-19', headline: 'Mini 10' }),
  item({ type: 'mini', id: 'DP·MINI·0100', date: '2026-10-19', headline: 'Mini 100' }),
  item({ type: 'sweep', id: 'DP·SWEEP·2026-10-24', date: '2026-10-24', headline: 'Sweep 100' }),
  item({ type: 'path', id: 'DP·PATH·0050', date: '2026-09-01', headline: 'Path 50' }),
];

export const FEED_LITE: FeedLite = {
  built: 'b',
  today: '2026-10-24',
  count: ITEMS.length,
  items: ITEMS,
};
