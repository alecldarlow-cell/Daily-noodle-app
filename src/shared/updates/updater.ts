/** How long between asks for an update while the app stays open. */
export const CHECK_EVERY_MS = 60 * 60_000;
/** An update waits until the player has been away this long, so nothing they're doing is lost. */
export const AWAY_MS = 15 * 60_000;

export interface UpdatesApi {
  isEnabled: boolean;
  checkForUpdateAsync(): Promise<{ isAvailable: boolean }>;
  fetchUpdateAsync(): Promise<{ isNew: boolean }>;
  reloadAsync(): Promise<void>;
}

export interface UpdaterDeps {
  updates: UpdatesApi;
  /** Whether a restart would interrupt nothing: Today is showing. */
  canApply: () => boolean;
  /** Puts every queued save on the disk before a restart. */
  flush: () => Promise<void>;
  now?: () => number;
}

/**
 * Over-the-air updates for a phone that keeps the app open for days. expo-updates on its own
 * looks only at a cold start, and applies what it finds at the next one. This also asks when
 * the app returns to the front (at most hourly) and downloads in the background, which Expo
 * calls safe. A downloaded update restarts the app only on a return to Today after a real
 * break; otherwise the next cold start applies it, as it always did. Failures wait for the
 * next try: the app keeps running the update it has.
 */
export function createUpdater({ updates, canApply, flush, now = Date.now }: UpdaterDeps) {
  let lastCheck = 0;
  let awaySince: number | null = null;
  let ready = false;
  let busy = false;
  let reloading = false;

  async function check(): Promise<void> {
    if (busy) return;
    busy = true;
    try {
      const { isAvailable } = await updates.checkForUpdateAsync();
      if (isAvailable && (await updates.fetchUpdateAsync()).isNew) ready = true;
    } catch {
      // No signal, or the server said no: the next return to the app tries again.
    } finally {
      busy = false;
    }
  }

  return {
    onAway(): void {
      awaySince = now();
    },
    async onActive(): Promise<void> {
      if (!updates.isEnabled || reloading) return;
      const away = awaySince === null ? 0 : now() - awaySince;
      awaySince = null;
      if (ready && away >= AWAY_MS && canApply()) {
        reloading = true;
        await flush().catch(() => undefined);
        await updates.reloadAsync().catch(() => {
          reloading = false;
        });
        return;
      }
      if (now() - lastCheck < CHECK_EVERY_MS) return;
      lastCheck = now();
      await check();
    },
  };
}
