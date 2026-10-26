import { act, renderHook } from '@testing-library/react-native';

import { useManualRefresh } from '../useManualRefresh';

interface Q {
  dataUpdatedAt: number;
  failureReason: unknown;
}

const start = (q: Q, run: () => Promise<unknown>) =>
  renderHook((p: { q: Q; run: () => Promise<unknown> }) => useManualRefresh(p.q, p.run), {
    initialProps: { q, run },
  });

describe('GIVEN a list that can be pulled to refresh', () => {
  describe('WHEN nobody has pulled', () => {
    it('THEN no spinner shows, even while React Query refetches on its own', async () => {
      const { result } = await start({ dataUpdatedAt: 1, failureReason: null }, async () => {});
      expect(result.current.refreshing).toBe(false);
    });
  });

  describe('WHEN it is pulled and the new list arrives', () => {
    it('THEN the spinner shows until then, and runs the fetch once', async () => {
      const run = jest.fn(() => new Promise<void>(() => {}));
      const { result, rerender } = await start({ dataUpdatedAt: 1, failureReason: null }, run);
      await act(async () => result.current.refresh());
      expect(run).toHaveBeenCalledTimes(1);
      expect(result.current.refreshing).toBe(true);
      await rerender({ q: { dataUpdatedAt: 2, failureReason: null }, run });
      expect(result.current.refreshing).toBe(false);
    });
  });

  describe('WHEN it is pulled and the first attempt fails (retries carry on)', () => {
    it('THEN the spinner stops at that failure, not after every retry', async () => {
      const old = new Error('before');
      const run = () => new Promise<void>(() => {});
      const { result, rerender } = await start({ dataUpdatedAt: 1, failureReason: old }, run);
      await act(async () => result.current.refresh());
      // the old failure still showing is not this pull's answer
      await rerender({ q: { dataUpdatedAt: 1, failureReason: old }, run });
      expect(result.current.refreshing).toBe(true);
      await rerender({ q: { dataUpdatedAt: 1, failureReason: new TypeError('offline') }, run });
      expect(result.current.refreshing).toBe(false);
    });
  });

  describe('WHEN the fetch settles with nothing new to show', () => {
    it('THEN the spinner stops anyway', async () => {
      let done!: () => void;
      const run = () => new Promise<void>((r) => (done = r));
      const { result } = await start({ dataUpdatedAt: 1, failureReason: null }, run);
      await act(async () => result.current.refresh());
      expect(result.current.refreshing).toBe(true);
      await act(async () => done());
      expect(result.current.refreshing).toBe(false);
    });

    it('THEN a fetch that throws stops it too', async () => {
      const { result } = await start({ dataUpdatedAt: 1, failureReason: null }, () =>
        Promise.reject(new Error('cancelled')),
      );
      await act(async () => result.current.refresh());
      expect(result.current.refreshing).toBe(false);
    });
  });

  describe('WHEN it is pulled again before an earlier fetch settles', () => {
    it('THEN the earlier one settling doesn’t stop the new spinner', async () => {
      const finish: (() => void)[] = [];
      const run = () => new Promise<void>((r) => finish.push(r));
      const { result } = await start({ dataUpdatedAt: 1, failureReason: null }, run);
      await act(async () => result.current.refresh());
      await act(async () => result.current.refresh());
      await act(async () => finish[0]!());
      expect(result.current.refreshing).toBe(true);
      await act(async () => finish[1]!());
      expect(result.current.refreshing).toBe(false);
    });
  });
});
