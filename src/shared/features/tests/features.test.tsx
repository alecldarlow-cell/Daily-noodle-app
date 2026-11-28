import { screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { appStorage } from '@/shared/storage';
import { mockSite, renderWithProviders } from '@/shared/testing';

import { ALL_ON, cachedFeatures, FEATURES_KEY, parseFeatures, useFeatures } from '..';

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
    expect(parseFeatures({ stats: false })).toEqual({
      archive: true,
      stats: false,
      signInCode: false,
    });
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
      signInCode: false,
    });
  });

  it('WHEN the file can’t be read THEN the last copy is used, or everything is on', async () => {
    mockSite({});
    appStorage.setItem(FEATURES_KEY, JSON.stringify({ archive: false, stats: true }));
    await renderWithProviders(<Show />);
    expect(screen.getByTestId('f')).toHaveTextContent('false/true');
  });
});

describe('GIVEN the sign-in code switch (#215)', () => {
  it('THEN it is on only when the file says true, unlike the others', () => {
    expect(parseFeatures({ signInCode: true }).signInCode).toBe(true);
    expect(parseFeatures({}).signInCode).toBe(false);
    expect(parseFeatures({ signInCode: 'yes' }).signInCode).toBe(false);
    expect(parseFeatures(null).signInCode).toBe(false);
    expect(ALL_ON.signInCode).toBe(false);
  });

  it('THEN the last copy the app saw can be read without a fetch', () => {
    appStorage.setItem(FEATURES_KEY, JSON.stringify({ archive: true, signInCode: true }));
    expect(cachedFeatures(appStorage)).toEqual({ archive: true, stats: true, signInCode: true });
    appStorage.setItem(FEATURES_KEY, '{oops');
    expect(cachedFeatures(appStorage)).toEqual(ALL_ON);
  });
});
