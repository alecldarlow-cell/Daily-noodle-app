/**
 * The build's public settings (eas.json `env`, or .env in development).
 *
 * Expo writes an EXPO_PUBLIC_ value into the bundle only where the code spells out
 * `process.env.EXPO_PUBLIC_NAME` in full; at run time a release build's `process.env`
 * holds nothing but NODE_ENV. So read them here, one by one, and pass this object
 * around instead of `process.env` (until 25 Oct 2026 the app's visit recording and the
 * sign-in switch read `process.env` through a variable and saw nothing on phones).
 */
export const BUILD_ENV: Readonly<Record<string, string | undefined>> = {
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_SYNC: process.env.EXPO_PUBLIC_SYNC,
};
