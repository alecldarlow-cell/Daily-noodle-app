import { screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { ALL_ON, FEATURES_KEY, parseFeatures, useFeatures } from '..';

function Show() {
  const f = useFeatures();
  return <Text testID="f">{`${f.archive}/${f.stats}`}</Text>;
}

beforeEach(() => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
});

describe('GIVEN the website’s features.json', () => {
  it('THEN only an explicit false turns a feature off', () => {
    expect(parseFeatures({ archive: true, stats: true })).toEqual(ALL_ON);
    expect(parseFeatures({ stats: false })).toEqual({ archive: true, stats: false });
    expect(parseFeatures({ archive: 0, stats: 'no' })).toEqual(ALL_ON);
    expect(parseFeatures(null)).toEqual(ALL_ON);
  });

  it('WHEN the site switches stats off THEN the app follows and keeps the answer for offline', async () => {
    mockSite({ 'features.json': { archive: true, stats: false } });
    await renderWithProviders(<Show />);
    await waitFor(() => expect(screen.getByTestId('f')).toHaveTextContent('true/false'));
    expect(JSON.parse(appStorage.getItem(FEATURES_KEY) ?? 'null')).toEqual({
      archive: true,
      stats: false,
    });
  });

  it('WHEN the file can’t be read THEN the last copy is used, or everything is on', async () => {
    mockSite({});
    appStorage.setItem(FEATURES_KEY, JSON.stringify({ archive: false, stats: true }));
    await renderWithProviders(<Show />);
    expect(screen.getByTestId('f')).toHaveTextContent('false/true');
  });
});
