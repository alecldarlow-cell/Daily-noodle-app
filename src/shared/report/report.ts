import { Platform } from 'react-native';

import { buildInfo } from '@/shared/build';
import { BUILD_ENV } from '@/shared/env';

/** What can be reported: a screen or the app crashing, or a save that didn't reach the disk. */
export type ErrorKind = 'crash' | 'fatal' | 'save';

/** No more than this many reports from one launch, so a loop can't flood the log. */
export const MAX_PER_LAUNCH = 5;

/**
 * An error's text with anything that could name someone taken out. The log says what broke,
 * never who (SITE.md › The app's error log).
 */
export function scrub(text: string): string {
  return text
    .replace(/[^\s@"'<>]+@[^\s@"'<>]+/g, '[email]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]')
    .replace(/\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\b/g, '[token]')
    .replace(/(access_token|refresh_token)=[^&\s]+/g, '$1=[token]');
}

export interface ReporterDeps {
  env?: Readonly<Record<string, string | undefined>>;
  dev?: boolean;
  post?: typeof fetch;
}

/**
 * The app's error log, sent to the site's `log_app_error`. Off in development and when the
 * build has no Supabase settings; silent until `allow` is given (the player's opt-out can't
 * be read before the saves load) and whenever it says no. One report per distinct error, a
 * few per launch; a report that can't be sent is dropped.
 */
export function createReporter({
  env = BUILD_ENV,
  dev = __DEV__,
  post = fetch,
}: ReporterDeps = {}) {
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const seen = new Set<string>();
  let allow: () => boolean = () => false;
  return {
    /** Says whether reports may go: not until the saves are read, never after an opt-out. */
    setAllow(fn: () => boolean): void {
      allow = fn;
    },
    report(kind: ErrorKind, error: unknown, screen?: string): void {
      if (dev || !url || !key) return;
      try {
        if (!allow()) return;
        const e = error instanceof Error ? error : new Error(String(error));
        const message = scrub(`${e.name}: ${e.message}`);
        const id = `${kind}|${screen ?? ''}|${message}`;
        if (seen.has(id) || seen.size >= MAX_PER_LAUNCH) return;
        seen.add(id);
        const b = buildInfo();
        void post(`${url}/rest/v1/rpc/log_app_error`, {
          method: 'POST',
          headers: { apikey: key, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            p: {
              kind,
              message,
              stack: scrub(String(e.stack ?? ''))
                .split('\n')
                .slice(0, 12)
                .join('\n'),
              screen,
              version: b.version,
              update: b.update,
              platform: Platform.OS,
            },
          }),
        }).catch(() => undefined);
      } catch {
        // Reporting must never add a failure of its own.
      }
    },
  };
}

export const reporter = createReporter();

interface GlobalErrors {
  getGlobalHandler(): (e: unknown, fatal?: boolean) => void;
  setGlobalHandler(fn: (e: unknown, fatal?: boolean) => void): void;
}

/** How long a fatal error's report gets to leave before the phone closes the app. */
export const FATAL_GRACE_MS = 300;

/**
 * Reports what no screen caught, then lets React Native carry on as it would. Called once
 * at launch, when the saves (and so the opt-out) have been read.
 */
export function watchGlobalErrors(
  errors: GlobalErrors | undefined = (globalThis as { ErrorUtils?: GlobalErrors }).ErrorUtils,
  report: (kind: ErrorKind, e: unknown) => void = reporter.report,
): void {
  if (!errors) return;
  const before = errors.getGlobalHandler();
  errors.setGlobalHandler((e, fatal) => {
    report(fatal ? 'fatal' : 'crash', e);
    if (fatal) setTimeout(() => before(e, fatal), FATAL_GRACE_MS);
    else before(e, fatal);
  });
}
