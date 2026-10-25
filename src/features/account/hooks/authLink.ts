/**
 * The sign-in link arrives back in the app as dailynoodle://auth#access_token=…&
 * refresh_token=… (Supabase's email link with redirect_to the app). Read the tokens,
 * or the error Supabase put there instead.
 */
export type AuthLink =
  | { ok: true; access_token: string; refresh_token: string }
  | { ok: false; error: string }
  | null;

export function readAuthLink(url: string | null | undefined): AuthLink {
  // Only links to the app's auth path: dailynoodle://auth, …/--/auth in development builds.
  if (!url || !/:\/\/(?:[^#?]*\/)?auth(?:[/?#]|$)/.test(url)) return null;
  const params = new URLSearchParams();
  const hash = url.split('#')[1] ?? '';
  const query = url.split('#')[0]!.split('?')[1] ?? '';
  for (const part of [query, hash]) new URLSearchParams(part).forEach((v, k) => params.set(k, v));
  const err = params.get('error_description') || params.get('error');
  if (err) return { ok: false, error: err.replace(/\+/g, ' ') };
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (access_token && refresh_token) return { ok: true, access_token, refresh_token };
  return null;
}
