import { useForgetOldPlayer } from '../hooks/useLeagues';
import { useCatchUp, useSubmitFinishes } from '../hooks/useResults';

/**
 * Mounted once at the app's root: posts every finished puzzle to the player's leagues
 * (members only; the server keeps the first result), and catches up any that couldn't be
 * sent. Renders nothing.
 */
export function LeagueResults() {
  useSubmitFinishes();
  useCatchUp();
  useForgetOldPlayer();
  return null;
}
