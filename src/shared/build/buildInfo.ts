import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

export interface BuildInfo {
  version: string;
  /** The EAS Update channel ("preview", "production"), or "dev" when none. */
  channel: string;
  /** The first 8 characters of the running update's id, or "built-in". */
  update: string;
}

/** Which build and update this is, so a bug report can name it exactly. */
export function buildInfo(): BuildInfo {
  const version = Constants.expoConfig?.version ?? '0.0.0';
  const channel = Updates.channel || 'dev';
  const update =
    !Updates.updateId || Updates.isEmbeddedLaunch ? 'built-in' : Updates.updateId.slice(0, 8);
  return { version, channel, update };
}

/** "Version 0.1.0 · preview · update 1a2b3c4d" */
export function buildLine(b: BuildInfo = buildInfo()): string {
  return `Version ${b.version} · ${b.channel} · ${b.update === 'built-in' ? 'built-in' : `update ${b.update}`}`;
}
