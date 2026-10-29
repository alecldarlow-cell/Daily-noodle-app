import { render } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { createTracker, type TrackEvent } from '../tracker';
import { VisitRecorder } from '../VisitRecorder';

describe('GIVEN the app’s root', () => {
  it('THEN the recorder listens while mounted, sends every 10 s and when the app is put away', async () => {
    jest.useFakeTimers();
    const off = jest.fn();
    const recorder = { listen: jest.fn(() => off), screen: jest.fn() };
    const tracker = { flush: jest.fn(), track: jest.fn(), pageView: jest.fn(), pending: () => 0 };
    let changed: (s: string) => void = () => {};
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_t, fn) => {
      changed = fn as (s: string) => void;
      return { remove } as never;
    });
    const r = await render(<VisitRecorder recorder={recorder} tracker={tracker} />);
    expect(recorder.listen).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(10_000);
    expect(tracker.flush).toHaveBeenCalledTimes(1);
    changed('background');
    changed('active');
    expect(tracker.flush).toHaveBeenCalledTimes(2);
    await r.unmount();
    expect(off).toHaveBeenCalled();
    expect(remove).toHaveBeenCalled();
    jest.useRealTimers();
  });
});

describe.each([
  ['a store that says when a key changes (the app’s)', true],
  ['a plain store', false],
])('GIVEN events queued before the player opts out, on %s', (_name, live) => {
  function setup() {
    const m = new Map<string, string>();
    const subs = new Map<string, () => void>();
    const store = {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => {
        m.set(k, v);
        subs.get(k)?.();
      },
      ...(live
        ? {
            subscribe: (k: string, fn: () => void) => {
              subs.set(k, fn);
              return () => subs.delete(k);
            },
          }
        : {}),
    };
    const sent: TrackEvent[][] = [];
    let n = 0;
    const tracker = createTracker({
      store,
      send: async (b) => void sent.push(b),
      uuid: () => `${String(++n).padStart(8, '0')}-0000-4000-8000-000000000000`,
    });
    tracker.track('puzzle_start', {}, 'reports/x.html', 'pv');
    tracker.track('puzzle_end', {}, 'reports/x.html', 'pv');
    expect(tracker.pending()).toBe(2);
    store.setItem('digi.optout', '1'); // the privacy page's switch, through the bridge
    if (live) expect(tracker.pending()).toBe(0);
    return { tracker, sent };
  }

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('WHEN the 10-second send comes round', () => {
    it('THEN nothing queued is sent', async () => {
      jest.useFakeTimers();
      const { tracker, sent } = setup();
      const recorder = { listen: jest.fn(() => () => {}), screen: jest.fn() };
      await render(<VisitRecorder recorder={recorder} tracker={tracker} />);
      jest.advanceTimersByTime(10_000);
      expect(sent).toEqual([]);
      expect(tracker.pending()).toBe(0);
    });
  });

  describe('WHEN the app is put away', () => {
    it('THEN nothing queued is sent', async () => {
      let changed: (s: string) => void = () => {};
      jest.spyOn(AppState, 'addEventListener').mockImplementation((_t, fn) => {
        changed = fn as (s: string) => void;
        return { remove: jest.fn() } as never;
      });
      const { tracker, sent } = setup();
      const recorder = { listen: jest.fn(() => () => {}), screen: jest.fn() };
      await render(<VisitRecorder recorder={recorder} tracker={tracker} />);
      changed('background');
      expect(sent).toEqual([]);
      expect(tracker.pending()).toBe(0);
    });
  });
});
