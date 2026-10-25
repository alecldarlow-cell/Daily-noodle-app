import { act, renderHook } from '@testing-library/react-native';

import { onVisit, type PuzzleVisit } from '../finishBus';
import { usePuzzleVisit } from '../usePuzzleVisit';

const PATH = 'reports/2026-10-25-word-link-0050.html';

describe('GIVEN a native puzzle screen', () => {
  it('THEN opening announces once, and Play announces one start', async () => {
    const heard: PuzzleVisit[] = [];
    const off = onVisit((v) => heard.push(v));
    const { result } = await renderHook(() => usePuzzleVisit(PATH, 'link'));
    await act(() => {
      result.current();
      result.current();
    });
    off();
    expect(heard).toEqual([
      { ev: 'open', path: PATH, type: 'link' },
      { ev: 'start', path: PATH, type: 'link' },
    ]);
  });

  it('THEN a finished puzzle reopened is opened but never started', async () => {
    const heard: PuzzleVisit[] = [];
    const off = onVisit((v) => heard.push(v));
    const { result } = await renderHook(() => usePuzzleVisit(PATH, 'link', true));
    await act(() => result.current());
    off();
    expect(heard.map((v) => v.ev)).toEqual(['open']);
  });

  it('THEN a failing listener doesn’t stop the others', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const heard: string[] = [];
    const a = onVisit(() => {
      throw new Error('boom');
    });
    const b = onVisit((v) => heard.push(v.ev));
    await renderHook(() => usePuzzleVisit(PATH, 'link'));
    a();
    b();
    expect(heard).toEqual(['open']);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
