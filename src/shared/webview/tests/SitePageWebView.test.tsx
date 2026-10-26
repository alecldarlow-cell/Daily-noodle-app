import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Linking } from 'react-native';

import { createCachedStorage } from '@/shared/storage';

import { HIDE_MASTHEAD, SitePageWebView, sitePageUrl } from '../SitePageWebView';

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

const go = (url: string, isTopFrame = true): boolean =>
  last.onShouldStartLoadWithRequest({ url, isTopFrame });

describe('GIVEN the privacy page opened in the app', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('WHEN it loads under the app’s own header', () => {
    it('THEN the page’s masthead is hidden before it shows, so there is one header', async () => {
      await render(<SitePageWebView path="/how-to-play.html#mini" />);
      const js: string = last.injectedJavaScriptBeforeContentLoaded;
      expect(js.startsWith(HIDE_MASTHEAD)).toBe(true);
      expect(js).toContain('header.mast{display:none !important}');
      // The bridge still ends the script with true; (react-native-webview's rule).
      expect(js.trimEnd().endsWith('true;')).toBe(true);
    });

    it('THEN the hiding script runs in a page without a head and adds the rule', () => {
      const added: { textContent: string }[] = [];
      const doc = {
        head: null,
        createElement: () => ({ textContent: '' }),
        documentElement: { appendChild: (el: { textContent: string }) => added.push(el) },
      };
      new Function('document', HIDE_MASTHEAD)(doc);
      expect(added).toHaveLength(1);
      expect(added[0]!.textContent).toContain('header.mast');
    });
  });

  it('THEN it loads the live page tagged as the app, with web storage on and inst 2 set', async () => {
    await render(<SitePageWebView path="/privacy.html" />);
    expect(last.source).toEqual({ uri: 'https://dailynoodle.co.uk/privacy.html?via=app' });
    expect(sitePageUrl('/privacy.html')).toBe('https://dailynoodle.co.uk/privacy.html?via=app');
    expect(sitePageUrl('/how-to-play.html#mini')).toBe(
      'https://dailynoodle.co.uk/how-to-play.html?via=app#mini',
    );
    expect(last.injectedJavaScriptBeforeContentLoaded).toContain('window.__DN_APP = 2');
    expect(last.domStorageEnabled).toBe(true);
    expect(screen.getByTestId('site-webview')).toBeOnTheScreen();
  });

  describe('WHEN the page follows a link', () => {
    it('THEN the page itself and frames load in place', async () => {
      await render(<SitePageWebView path="/privacy.html" />);
      expect(go('https://dailynoodle.co.uk/privacy.html?via=app')).toBe(true);
      expect(go('https://example.com/frame', false)).toBe(true);
    });

    it('THEN the puzzles list goes back to the app', async () => {
      await render(<SitePageWebView path="/privacy.html" />);
      expect(go('https://dailynoodle.co.uk/puzzles.html')).toBe(false);
      expect(router.back).toHaveBeenCalledTimes(1);
    });

    it('THEN a puzzle opens in the app', async () => {
      await render(<SitePageWebView path="/privacy.html" />);
      expect(go('https://dailynoodle.co.uk/reports/2026-10-24-crossword-mini-0105.html')).toBe(
        false,
      );
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/play/[type]/[file]',
        params: { type: 'mini', file: '2026-10-24-crossword-mini-0105' },
      });
    });

    it('THEN email and other sites open outside the app', async () => {
      const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
      await render(<SitePageWebView path="/privacy.html" />);
      expect(go('mailto:contact@dailynoodle.co.uk')).toBe(false);
      expect(go('https://ico.org.uk/make-a-complaint/')).toBe(false);
      expect(go('https://dailynoodle.co.uk/games.html')).toBe(false);
      expect(open.mock.calls.map((c) => c[0])).toEqual([
        'mailto:contact@dailynoodle.co.uk',
        'https://ico.org.uk/make-a-complaint/',
        'https://dailynoodle.co.uk/games.html',
      ]);
    });
  });

  describe('WHEN the page can’t be reached', () => {
    it('THEN it says so, and Try again reloads it', async () => {
      await render(<SitePageWebView path="/privacy.html" testID="privacy-webview" />);
      await act(() => last.onError());
      expect(screen.getByTestId('privacy-webview-offline')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
      expect(screen.getByTestId('privacy-webview')).toBeOnTheScreen();
    });

    it('THEN an HTTP error counts as failed, a redirect does not', async () => {
      await render(<SitePageWebView path="/privacy.html" />);
      await act(() => last.onHttpError({ nativeEvent: { statusCode: 302 } }));
      expect(screen.getByTestId('site-webview')).toBeOnTheScreen();
      await act(() => last.onHttpError({ nativeEvent: { statusCode: 404 } }));
      expect(screen.getByTestId('site-webview-offline')).toBeOnTheScreen();
    });
  });

  describe('WHEN the player taps “Don’t record my visits” on the page', () => {
    it('THEN the app stops recording too and forgets its visitor code; turning it back on clears the switch', async () => {
      const backend = {
        getAllKeys: async () => [],
        multiGet: async () => [],
        setItem: async () => {},
      };
      const store = createCachedStorage(backend);
      store.setItem('digi.aid', '11111111-1111-4111-8111-111111111111');
      await render(<SitePageWebView path="/privacy.html" store={store} />);
      expect(last.injectedJavaScriptBeforeContentLoaded).toContain(
        '11111111-1111-4111-8111-111111111111',
      );
      const send = (m: unknown) =>
        act(() => last.onMessage({ nativeEvent: { data: JSON.stringify(m) } }));
      await send({ t: 'id', key: 'digi.optout', value: '1' });
      await send({ t: 'id', key: 'digi.aid', value: null });
      expect(store.getItem('digi.optout')).toBe('1');
      expect(store.getItem('digi.aid')).toBe('');
      // a save message from this page is ignored: it writes none
      await send({ t: 'save', key: 'digi-mini-v1', value: '{"v":1,"done":{}}', id: '' });
      expect(store.getItem('digi-mini-v1')).toBeNull();
      await send({ t: 'id', key: 'digi.optout', value: null });
      expect(store.getItem('digi.optout')).toBe('');
    });
  });
});
