/* The cards at the top of a board: the board failing to load, and the one notice (board.html topCard). */
import type { BoardLeague } from '@noodle/core';
import { router } from 'expo-router';

import { appStorage, useStoredRaw } from '@/shared/storage';
import { useLondonDay } from '@/shared/time';

import { isOffline, sayError } from '../api/errors';
import { inviteLink, inviteText } from '../hooks/boardText';
import type { Flow, Notice } from '../hooks/useLeaguesFlow';
import { share, syncOn } from './boardShared';
import { Acts, Btn, Card, P } from './ui';

/** "Later" on the sign-in card, for the rest of the London day (the site's key). */
const PIN_LATER = 'noodle-board-pinlater';
/** Set by the first sync, so a player already signed in isn't asked to. */
const SYNCED_KEY = 'noodle-app-sync';

/** The board didn't load: why, in the site's words (no signal, or the server), and Try again. */
export function BoardFailed({
  error,
  busy,
  retry,
}: {
  error: unknown;
  busy: boolean;
  retry: () => void;
}) {
  const offline = isOffline(error);
  return (
    <Card title={offline ? 'You’re offline' : 'Couldn’t load the board'} testID="board-error">
      <P>
        {offline
          ? 'Couldn’t load the board. Check your connection, then try again.'
          : sayError(error)}
      </P>
      <Acts>
        <Btn
          variant="filled"
          label={busy ? 'Trying…' : 'Try again'}
          disabled={busy}
          onPress={retry}
          testID="board-retry"
        />
      </Acts>
    </Card>
  );
}

/** The league in the masthead: switch, start or join another. */
/** The one card at the top after something happened, else the PIN nudge (board.html topCard). */
export function TopCard({ flow, league }: { flow: Flow; league: BoardLeague }) {
  const today = useLondonDay();
  const later = useStoredRaw(PIN_LATER) === today;
  const n: Notice | null = flow.notice;
  const done = () => flow.setNotice(null);
  if (n?.k === 'created' && n.code === league.code)
    return (
      <Card title={`${league.name} is ready`} testID="notice-created">
        <P>Share the link in your group chat. Anyone who taps it picks a nickname and joins.</P>
        <Acts>
          <Btn
            variant="filled"
            label="Invite people"
            onPress={() =>
              share(`${inviteText(league.name)}\n${inviteLink(league.code)}`).then(done)
            }
          />
        </Acts>
      </Card>
    );
  if (n?.k === 'joined')
    return (
      <Card title={`You’re in ${league.name}`} testID="notice-joined">
        <P>
          Your results will show here every day. Got another group, like friends or work? Start a
          league for them too.
        </P>
        <Acts>
          <Btn
            variant="tonal"
            label="Start another league"
            onPress={() => (done(), flow.setView({ k: 'start', from: 'joined' }))}
          />
        </Acts>
        {syncOn() ? (
          <>
            <P>
              Playing on another phone or on the website too? Sign in with your email and your
              leagues come with you.
            </P>
            <Acts>
              <Btn
                label="Sign in on Account"
                onPress={() => (done(), router.navigate('/account'))}
              />
            </Acts>
          </>
        ) : null}
      </Card>
    );
  if (n?.k === 'moved')
    return (
      <Card title="Your leagues are here now" testID="notice-moved">
        <P>
          Results and streaks from your other player have been added to this app, and puzzles you
          finish here go on the board as {league.nick}.
        </P>
      </Card>
    );
  if (n?.k === 'claimed')
    return (
      <Card title={`You’re playing as ${n.nick} here too`} testID="notice-claimed">
        <P>
          Puzzles you finish in this app now go on your league’s boards, and the ones you’d already
          finished here have been added.
        </P>
      </Card>
    );
  // Email sign-in is how leagues follow a player (Alec's call). A PIN already set still works
  // on Already in this league?; nobody is asked to set one (6 Nov 2026).
  if (syncOn() && !later && !appStorage.getItem(SYNCED_KEY))
    return (
      <Card title="Keep your leagues" testID="signin-nudge">
        <P>Sign in with your email and your leagues follow you to another phone or the website.</P>
        <Acts>
          <Btn
            variant="filled"
            label="Sign in on Account"
            onPress={() => router.navigate('/account')}
          />
          <Btn label="Later" onPress={() => appStorage.setItem(PIN_LATER, today)} />
        </Acts>
      </Card>
    );
  return null;
}
