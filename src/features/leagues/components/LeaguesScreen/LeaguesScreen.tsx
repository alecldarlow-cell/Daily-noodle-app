import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { FONT, useTokens } from '@/shared/theme';
import { Screen } from '@/shared/ui';

import { asksAnything, useLeaguesFlow, type LeaguesParams } from '../../hooks/useLeaguesFlow';
import { useBoardState } from '../../hooks/boardStore';
import { BOARD_QUERY, useMine } from '../../hooks/useLeagues';
import { Board } from '../Board';
import { LeagueKicker, LeagueMenu } from '../BoardControls';
import { ClaimForm, CodeForm, InviteForm, Intro, PendCard, NickForm, StartForm } from '../Forms';

const CLEARED = { join: undefined, go: undefined, p: undefined, d: undefined, n: undefined };

/** While the tab is in view, the league list and the boards showing refresh this often. */
export const AUTO_REFRESH_MS = 60_000;

/**
 * Leagues: the player's daily boards, or an intro inviting them to start or join one.
 * Opened with `?join=<code>` (an invite), `?go=claim|start|code|home`, or `?p=<type>&d=<day>`
 * (a puzzle's board on a day, as board.html; the finish sheet's "See today's board").
 */
export function LeaguesScreen({
  focused = false,
}: {
  /** The tab is in view (the route's focus effect): refresh on return, then every minute. */
  focused?: boolean;
} = {}) {
  const t = useTokens();
  const params = useLocalSearchParams<{
    join?: string;
    go?: string;
    p?: string;
    d?: string;
    n?: string;
  }>();
  const flow = useLeaguesFlow(params as LeaguesParams);
  const mine = useMine(true);
  const qc = useQueryClient();
  const { view, league, pending } = flow;
  const leagues = useBoardState().leagues || [];
  const [menu, setMenu] = useState(false);

  // Once read, the ask is cleared from this tab's route, so the same invite or shortcut
  // opened again (an invite after "Not now", "Bring my leagues here" after Back) is new.
  const navigation = useNavigation();
  const ask = asksAnything(params as LeaguesParams) ? JSON.stringify(params) : '';
  useEffect(() => {
    if (ask) navigation.setParams(CLEARED as never);
  }, [ask, navigation]);

  // Alec, 7 Nov 2026: no pull-to-refresh (it fired when he swiped the pager). Instead the
  // league list and every board showing refresh when the tab comes back into view (not on
  // its first showing, which is fetching already) and every minute while it stays in view.
  const [settings, setSettings] = useState(false);
  const shownOnce = useRef(false);
  useEffect(() => {
    if (!focused) return;
    const refresh = () => {
      void mine.refetch();
      void qc.invalidateQueries({ queryKey: BOARD_QUERY });
    };
    if (shownOnce.current) refresh();
    shownOnce.current = true;
    const id = setInterval(refresh, AUTO_REFRESH_MS);
    return () => clearInterval(id);
    // mine.refetch is stable for the query's life; qc is the app's one client.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused]);

  let body;
  if (view.k === 'start') body = <StartForm flow={flow} />;
  else if (view.k === 'code') body = <CodeForm flow={flow} />;
  else if (view.k === 'invite')
    body = <InviteForm key={view.code} flow={flow} code={view.code} typed={view.typed} />;
  else if (view.k === 'claim')
    body = (
      <ClaimForm
        flow={flow}
        code={view.code}
        name={view.name}
        players={view.players}
        back={view.back}
      />
    );
  else if (view.k === 'nick' && league) body = <NickForm flow={flow} league={league} />;
  else if (pending) body = <PendCard flow={flow} pend={pending} />;
  else if (league)
    body = (
      <>
        {menu ? (
          <LeagueMenu
            flow={flow}
            league={league}
            leagues={leagues}
            onClose={() => setMenu(false)}
            onSettings={() => setSettings(true)}
          />
        ) : null}
        <Board
          flow={flow}
          league={league}
          settingsOpen={settings}
          onSettingsClose={() => setSettings(false)}
        />
      </>
    );
  else body = <Intro flow={flow} />;
  // On a board, the league's name is the masthead's kicker, a menu of leagues.
  const onBoard = view.k === 'home' && !pending && !!league;

  return (
    <Screen
      title="Leagues"
      // On a board the board scrolls itself, under its frozen pager (Alec, 8 Nov 2026).
      scroll={!onBoard}
      kicker={
        onBoard && league ? (
          <LeagueKicker league={league} open={menu} onPress={() => setMenu((m) => !m)} />
        ) : undefined
      }
      testID="leagues-screen">
      {body}
      {/* On a board the footer is gone (Alec, 7 Nov 2026: the board was crowded). */}
      {onBoard ? null : (
        <Text style={[styles.foot, { color: t.faint }]} testID="leagues-foot">
          Private leagues for friends and family. Only people in a league see its board.
        </Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  foot: { fontFamily: FONT.body, fontSize: 13, marginTop: 28, lineHeight: 19 },
});
