import { render } from '@testing-library/react-native';
import { AppState } from 'react-native';

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
