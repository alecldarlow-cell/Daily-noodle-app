import { announceFinish, onFinish } from '../finishBus';

describe('GIVEN listeners for finished puzzles', () => {
  it('THEN each hears every finish until it stops listening, and one failing does not stop others', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const heard: string[] = [];
    const offA = onFinish(() => {
      throw new Error('boom');
    });
    const offB = onFinish((f) => heard.push(f.path));
    const f = { path: 'reports/a.html', type: 'mini' as const, detail: { outcome: 'solved' } };
    announceFinish(f);
    offB();
    announceFinish(f);
    offA();
    expect(heard).toEqual(['reports/a.html']);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
