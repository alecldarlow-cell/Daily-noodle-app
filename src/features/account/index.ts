import { authClient } from './api/authClient';

export { AccountScreen } from './components/AccountScreen/AccountScreen';
export { AuthLinkScreen } from './components/AuthLinkScreen/AuthLinkScreen';
export { SyncRunner } from './components/SyncRunner/SyncRunner';

/** The signed-in player's access token, or null: for the Lab's votes (one person counts once). */
export async function accessToken(): Promise<string | null> {
  const c = authClient();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return data.session?.access_token ?? null;
}
