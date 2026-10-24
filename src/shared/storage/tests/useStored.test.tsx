import { act, renderHook } from '@testing-library/react-native';

import { createCachedStorage } from '../cachedStorage';
import { useStoredDocs, useStoredRaw } from '../useStoredJson';

const mem = () =>
  createCachedStorage({
    getAllKeys: async () => [],
    multiGet: async () => [],
    setItem: async () => {},
  });

describe('GIVEN a component reading saves', () => {
  describe('WHEN a save changes', () => {
    it('THEN it re-renders with the new value, and bad JSON reads as null', async () => {
      const s = mem();
      const { result } = await renderHook(() => ({
        raw: useStoredRaw('a', s),
        docs: useStoredDocs(['a', 'b'], s),
      }));
      expect(result.current.raw).toBeNull();
      expect(result.current.docs).toEqual({ a: null, b: null });
      await act(async () => s.setItem('a', '{"v":1}'));
      expect(result.current.raw).toBe('{"v":1}');
      expect(result.current.docs.a).toEqual({ v: 1 });
      await act(async () => s.setItem('b', '{oops'));
      expect(result.current.docs.b).toBeNull();
    });
  });
});
