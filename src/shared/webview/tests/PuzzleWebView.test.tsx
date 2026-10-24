import { createSaveStore } from '@noodle/core';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Linking, Share } from 'react-native';

import { onFinish } from '@/shared/results';
import { createCachedStorage } from '@/shared/storage';

import { PuzzleWebView } from '../PuzzleWebView';

// The native WebView, replaced by a stand-in that keeps its props for the test.
let last: Record<string, any> = {};
jest.mock('react-native-webview', () => {
  const { View } = jest.requireActual('react-native');
  return {
    WebView: (props: Record<string, unknown>) => {
      last = props;
      const { renderLoading: _r, ...rest } = props;
      return <View {...rest} />;
    },
  };
});
jest.mock('expo-router', () => ({ router: { back: jest.fn(), replace: jest.fn() } }));

const FILE = '2026-10-24-crossword-mini-0105';

function setup() {
  const backend = { getAllKeys: async () => [], multiGet: async () => [], setItem: async () => {} };
  const store = createCachedStorage(backend);
  store.setItem('digi-mini-v1', JSON.stringify({ v: 1, done: { A: { s: 1 } } }));
  return { store, saves: createSaveStore(store) };
}
const send = (m: unknown) =>
  act(() => last.onMessage({ nativeEvent: { data: JSON.stringify(m) } }));

describe('GIVEN a puzzle opened through the bridge', () => {
  beforeEach(() => jest.clearAllMocks());

  it('THEN it loads the live page tagged as the app, seeded with the player’s saves', async () => {
    const { store, saves } = setup();
    await render(<PuzzleWebView file={FILE} store={store} saves={saves} />);
    expect(last.source).toEqual({ uri: `https://dailynoodle.co.uk/reports/${FILE}.html?via=app` });
    expect(last.injectedJavaScriptBeforeContentLoaded).toContain('"digi-mini-v1"');
    expect(last.domStorageEnabled).toBe(true);
  });

  it('THEN a save from the page lands in the app’s store', async () => {
    const { store, saves } = setup();
    await render(<PuzzleWebView file={FILE} store={store} saves={saves} />);
    await send({
      t: 'save',
      key: 'digi-mini-v1',
      value: JSON.stringify({ v: 1, done: { B: { s: 2 } } }),
      id: 'DP·MINI·0105',
    });
    expect(Object.keys(JSON.parse(store.getItem('digi-mini-v1')!).done).sort()).toEqual(['A', 'B']);
  });

  it('THEN Share opens the phone’s share sheet and the finish is reported', async () => {
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    const onEnd = jest.fn();
    const heard = jest.fn();
    const off = onFinish(heard);
    const { store, saves } = setup();
    await render(<PuzzleWebView file={FILE} store={store} saves={saves} onEnd={onEnd} />);
    await send({ t: 'share', text: '✏️ Mini #105 — 1:27\ndailynoodle.co.uk/mini' });
    await send({ t: 'end', detail: { outcome: 'solved' } });
    await send({ nonsense: true });
    expect(share).toHaveBeenCalledWith({ message: '✏️ Mini #105 — 1:27\ndailynoodle.co.uk/mini' });
    expect(onEnd).toHaveBeenCalledWith({ outcome: 'solved' }, FILE);
    expect(heard).toHaveBeenCalledWith({
      path: `reports/${FILE}.html`,
      type: 'mini',
      detail: { outcome: 'solved' },
    });
    off();
  });

  it('THEN links go where they belong', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const { store, saves } = setup();
    await render(<PuzzleWebView file={FILE} store={store} saves={saves} />);
    const go = (url: string, isTopFrame = true) =>
      last.onShouldStartLoadWithRequest({ url, isTopFrame });
    expect(go(`https://dailynoodle.co.uk/reports/${FILE}.html?via=app`)).toBe(true);
    expect(go('https://example.com/ad', false)).toBe(true);
    expect(go('https://dailynoodle.co.uk/puzzles.html')).toBe(false);
    expect(router.back).toHaveBeenCalled();
    expect(go('https://dailynoodle.co.uk/reports/2026-10-24-logic-doku-0103.html')).toBe(false);
    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/play/[type]/[file]',
      params: { type: 'doku', file: '2026-10-24-logic-doku-0103' },
    });
    expect(go('https://example.com/')).toBe(false);
    expect(open).toHaveBeenCalledWith('https://example.com/');
  });

  it('THEN a page that fails to load offers to try again', async () => {
    const { store, saves } = setup();
    await render(<PuzzleWebView file={FILE} store={store} saves={saves} />);
    await act(() => last.onHttpError({ nativeEvent: { statusCode: 404 } }));
    expect(screen.getByTestId('play-offline')).toBeOnTheScreen();
    await act(() => fireEvent.press(screen.getByText('Try again')));
    expect(screen.getByTestId('play-webview')).toBeOnTheScreen();
    await act(() => last.onError());
    expect(screen.getByTestId('play-offline')).toBeOnTheScreen();
  });

  it('THEN a server answer below 400 is not an error', async () => {
    const { store, saves } = setup();
    await render(<PuzzleWebView file={FILE} store={store} saves={saves} />);
    await act(() => last.onHttpError({ nativeEvent: { statusCode: 304 } }));
    expect(screen.getByTestId('play-webview')).toBeOnTheScreen();
    expect(last.renderLoading()).toBeTruthy();
  });
});
