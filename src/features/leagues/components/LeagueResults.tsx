import { useForgetOldPlayer } from '../hooks/useLeagues';
import { useSubmitFinishes } from '../hooks/useResults';

/**
 * Mounted once at the app's root: posts every finished puzzle to the player's leagues
 * (members only; the server keeps the first result). Renders nothing.
 */
export function LeagueResults() {
  useSubmitFinishes();
  useForgetOldPlayer();
  return null;
}
