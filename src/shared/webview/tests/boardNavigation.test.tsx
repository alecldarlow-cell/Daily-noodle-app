import { render } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Linking } from 'react-native';

import { createSaveStore } from '@noodle/core';

import { createCachedStorage } from '@/shared/storage';

import { decide } from '../navigation';
import { PuzzleWebView } from '../PuzzleWebView';
import { SitePageWebView } from '../SitePageWebView';

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
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), dismissTo: jest.fn() },
}));

const CUR = '2026-10-24-crossword-mini-0105';
const S = 'https://dailynoodle.co.uk';
const go = (url: string): boolean => last.onShouldStartLoadWithRequest({ url, isTopFrame: true });

describe('GIVEN a bridged page links to the board', () => {
  describe('WHEN it is board.html with a puzzle and day', () => {
    it('THEN the Leagues tab opens with them, the result tag dropped', () => {
      expect(decide(`${S}/board.html?p=mini&d=2026-10-24&from=result`, CUR)).toEqual({
        kind: 'leagues',
        params: { p: 'mini', d: '2026-10-24' },
      });
      // dn-board.js links relative to the puzzle page, so they arrive resolved like this.
      expect(decide(`${S}/board.html?p=x`, CUR)).toEqual({ kind: 'leagues', params: { p: 'x' } });
    });
  });
  describe('WHEN it is board.html bare, or an invite', () => {
    it('THEN the Leagues tab opens, carrying the invite’s code', () => {
      expect(decide(`${S}/board.html`, CUR)).toEqual({ kind: 'leagues', params: {} });
      expect(decide(`${S}/board.html?join=ABCD2345&v=2`, CUR)).toEqual({
        kind: 'leagues',
        params: { join: 'ABCD2345' },
      });
    });
  });
  describe('WHEN it is a personal link (#dnmove=)', () => {
    it('THEN it stays with the browser, which it is for', () => {
      expect(decide(`${S}/board.html#dnmove=abc`, CUR)).toEqual({ kind: 'external' });
    });
  });
});

describe('GIVEN the WebViews follow a board link', () => {
  beforeEach(() => jest.clearAllMocks());

  it('THEN the puzzle page goes down to the Leagues tab, not to the browser', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const backend = {
      getAllKeys: async () => [],
      multiGet: async () => [],
      setItem: async () => {},
    };
    const store = createCachedStorage(backend);
    await render(<PuzzleWebView file={CUR} store={store} saves={createSaveStore(store)} />);
    expect(go(`${S}/board.html?p=mini&d=2026-10-24&from=result`)).toBe(false);
    expect(router.dismissTo).toHaveBeenCalledWith({
      pathname: '/leagues',
      params: { p: 'mini', d: '2026-10-24' },
    });
    expect(open).not.toHaveBeenCalled();
  });

  it('THEN a site page does the same', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await render(<SitePageWebView path="/privacy.html" />);
    expect(go(`${S}/board.html?p=doku&d=2026-10-23`)).toBe(false);
    expect(router.dismissTo).toHaveBeenCalledWith({
      pathname: '/leagues',
      params: { p: 'doku', d: '2026-10-23' },
    });
    expect(open).not.toHaveBeenCalled();
  });
});
