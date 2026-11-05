import { AWAY_MS, CHECK_EVERY_MS, createUpdater, type UpdatesApi } from '../updater';

function setup(over: Partial<UpdatesApi> = {}, today = true) {
  let t = 1_000_000_000;
  const updates = {
    isEnabled: true,
    checkForUpdateAsync: jest.fn(async () => ({ isAvailable: true })),
    fetchUpdateAsync: jest.fn(async () => ({ isNew: true })),
    reloadAsync: jest.fn(async () => undefined),
    ...over,
  };
  const flush = jest.fn(async () => undefined);
  const u = createUpdater({ updates, canApply: () => today, flush, now: () => t });
  return { u, updates, flush, pass: (ms: number) => (t += ms) };
}

describe('GIVEN the app returning to the front', () => {
  it('WHEN an update is out THEN it downloads, and the app does not restart yet', async () => {
    const { u, updates } = setup();
    await u.onActive();
    expect(updates.fetchUpdateAsync).toHaveBeenCalledTimes(1);
    expect(updates.reloadAsync).not.toHaveBeenCalled();
  });

  it('WHEN it comes back again within the hour THEN it does not ask again', async () => {
    const { u, updates, pass } = setup();
    await u.onActive();
    pass(CHECK_EVERY_MS - 1);
    await u.onActive();
    expect(updates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
    pass(1);
    await u.onActive();
    expect(updates.checkForUpdateAsync).toHaveBeenCalledTimes(2);
  });

  it('WHEN a downloaded update waits and the player returns to Today after a break THEN saves go down and it restarts', async () => {
    const { u, updates, flush, pass } = setup();
    await u.onActive();
    u.onAway();
    pass(AWAY_MS);
    await u.onActive();
    expect(flush).toHaveBeenCalled();
    expect(updates.reloadAsync).toHaveBeenCalledTimes(1);
  });

  it('WHEN the player is only briefly away THEN nothing restarts', async () => {
    const { u, updates, pass } = setup();
    await u.onActive();
    u.onAway();
    pass(AWAY_MS - 1);
    await u.onActive();
    expect(updates.reloadAsync).not.toHaveBeenCalled();
  });

  it('WHEN a puzzle or form is showing THEN nothing restarts, however long the break', async () => {
    const { u, updates, pass } = setup({}, false);
    await u.onActive();
    u.onAway();
    pass(AWAY_MS * 10);
    await u.onActive();
    expect(updates.reloadAsync).not.toHaveBeenCalled();
  });

  it('WHEN the check fails THEN nothing is thrown, and the next hour tries again', async () => {
    const check = jest.fn(async () => {
      throw new Error('no signal');
    });
    const { u, pass } = setup({ checkForUpdateAsync: check });
    await expect(u.onActive()).resolves.toBeUndefined();
    pass(CHECK_EVERY_MS);
    await u.onActive();
    expect(check).toHaveBeenCalledTimes(2);
  });

  it('WHEN updates are off (a development build) THEN nothing is asked', async () => {
    const { u, updates } = setup({ isEnabled: false });
    await u.onActive();
    expect(updates.checkForUpdateAsync).not.toHaveBeenCalled();
  });
});
