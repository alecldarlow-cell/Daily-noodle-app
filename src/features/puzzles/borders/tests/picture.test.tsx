/* #190 (review of 27 Nov 2026): the Borders map page loads once and redraws in place. */
import { act, render, screen } from '@testing-library/react-native';

import { mapHtml, mapUpdate } from '../components/drawing';
import { Picture, REDRAW_FALLBACK_MS } from '../components/Picture';
import { borders15 } from './fixtures';

const mockInjected: string[] = [];
let mockAck = true;
let mockMounts = 0;
jest.mock('react-native-webview', () => {
  const { createElement, forwardRef, useEffect, useImperativeHandle } =
    jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  type P = {
    source: { html: string };
    onMessage?: (e: { nativeEvent: { data: string } }) => void;
  };
  return {
    WebView: forwardRef((p: P, ref) => {
      useEffect(() => {
        mockMounts++;
      }, []);
      useImperativeHandle(ref, () => ({
        injectJavaScript: (js: string) => {
          mockInjected.push(js);
          const n = /postMessage\('(drawn:\d+)'\)/.exec(js);
          if (n && mockAck) p.onMessage?.({ nativeEvent: { data: n[1]! } });
        },
      }));
      return createElement(View, { testID: 'drawing', accessibilityHint: p.source.html });
    }),
  };
});

const c = {} as never;
const [q1, q2] = borders15.qs;
const page = () => String(screen.getByTestId('drawing').props.accessibilityHint);

beforeEach(() => {
  mockInjected.length = 0;
  mockAck = true;
  mockMounts = 0;
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

function show(q: typeof q1, inset = false) {
  return (
    <Picture html={mapHtml(q!, inset, c)} update={mapUpdate(q!, inset)} label="Country outline" />
  );
}

describe('GIVEN the Borders map picture', () => {
  it('THEN the first question loads as a page, with nothing to run', async () => {
    await render(show(q1));
    expect(page()).toContain(q1!.d);
    expect(mockInjected).toEqual([]);
    expect(mockMounts).toBe(1);
  });

  describe('WHEN the next question comes', () => {
    it('THEN it is drawn into the same page: no reload, so no flash', async () => {
      const r = await render(show(q1));
      await r.rerender(show(q2));
      expect(mockMounts).toBe(1);
      expect(page()).toContain(q1!.d);
      expect(mockInjected).toHaveLength(1);
      expect(mockInjected[0]).toContain(q2!.d);
      expect(mockInjected[0]).toContain('setInset(false)');
      await act(async () => {
        jest.advanceTimersByTime(REDRAW_FALLBACK_MS * 2);
      });
      expect(mockMounts).toBe(1);
    });

    it('THEN a hint redraws it with the inset', async () => {
      const r = await render(show(q1));
      await r.rerender(show(q1, true));
      expect(mockInjected.at(-1)).toContain('setInset(true)');
      expect(mockMounts).toBe(1);
    });

    it('THEN the same content again runs nothing', async () => {
      const r = await render(show(q1));
      await r.rerender(show(q1));
      expect(mockInjected).toEqual([]);
    });
  });

  describe('WHEN a redraw never reports back', () => {
    it('THEN the page reloads with the current question, as it used to', async () => {
      mockAck = false;
      const r = await render(show(q1));
      await r.rerender(show(q2));
      expect(mockMounts).toBe(1);
      await act(async () => {
        jest.advanceTimersByTime(REDRAW_FALLBACK_MS);
      });
      expect(mockMounts).toBe(2);
      expect(page()).toContain(q2!.d);
    });
  });

  it('THEN the redraw sets the question’s data, the inset, and draws: the page’s own steps', () => {
    const js = mapUpdate(q2!, true);
    expect(js.startsWith('C={')).toBe(true);
    expect(js).toContain(q2!.d);
    expect(js.endsWith(';setInset(true);go();')).toBe(true);
    expect(js).not.toContain('</script');
    expect(mapHtml(q1!, false, c)).toContain('function setInset(on)');
  });

  it('THEN a picture with no update still reloads when its page changes, as before', async () => {
    const r = await render(<Picture html="<p>a</p>" />);
    await r.rerender(<Picture html="<p>b</p>" />);
    expect(page()).toBe('<p>b</p>');
    expect(mockInjected).toEqual([]);
  });
});
