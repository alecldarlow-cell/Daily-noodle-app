// Links the phone hands the app (expo-router): the site's invite links open the league's
// invite on the Leagues tab, and a shared result's short link (dailynoodle.co.uk/mini …)
// opens today's puzzle of that type (systemPath, AF-010); everything else goes to the
// router unchanged.
import { systemPath } from '@/shared/webview';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return systemPath(path);
}
