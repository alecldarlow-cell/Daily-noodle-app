import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { FONT, useTokens } from '@/shared/theme';
import { Screen } from '@/shared/ui';

import { asksAnything, useLeaguesFlow, type LeaguesParams } from '../../hooks/useLeaguesFlow';
import { BOARD_QUERY, useMine } from '../../hooks/useLeagues';
import { Board } from '../Board';
import {
  ClaimForm,
  CodeForm,
  InviteForm,
  Intro,
  PasteForm,
  PendCard,
  PinForm,
  StartForm,
} from '../Forms';

const CLEARED = { join: undefined, go: undefined, p: undefined, d: undefined, n: undefined };

/**
 * Leagues: the player's daily boards, or an intro inviting them to start or join one.
 * Opened with `?join=<code>` (an invite), `?go=claim|paste|start|code|home`, or `?p=<type>&d=<day>`
 * (a puzzle's board on a day, as board.html; the finish sheet's "See today's board").
 */
export function LeaguesScreen() {
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

  // Once read, the ask is cleared from this tab's route, so the same invite or shortcut
  // opened again (an invite after "Not now", "Bring my leagues here" after Back) is new.
  const navigation = useNavigation();
  const ask = asksAnything(params as LeaguesParams) ? JSON.stringify(params) : '';
  useEffect(() => {
    if (ask) navigation.setParams(CLEARED as never);
  }, [ask, navigation]);

  // Pull to refresh: the league list and every board showing, with the spinner held
  // until they're back.
  const [refreshing, setRefreshing] = useState(false);
  const refresh = () => {
    setRefreshing(true);
    void Promise.all([mine.refetch(), qc.invalidateQueries({ queryKey: BOARD_QUERY })]).finally(
      () => setRefreshing(false),
    );
  };

  let body;
  if (view.k === 'start') body = <StartForm flow={flow} />;
  else if (view.k === 'code') body = <CodeForm flow={flow} />;
  else if (view.k === 'invite') body = <InviteForm key={view.code} flow={flow} code={view.code} />;
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
  else if (view.k === 'pin') body = <PinForm flow={flow} fresh={view.fresh} />;
  else if (view.k === 'paste') body = <PasteForm flow={flow} />;
  else if (pending) body = <PendCard flow={flow} pend={pending} />;
  else if (league) body = <Board flow={flow} league={league} />;
  else body = <Intro flow={flow} />;

  return (
    <Screen title="Leagues" testID="leagues-screen" onRefresh={refresh} refreshing={refreshing}>
      {body}
      <Text style={[styles.foot, { color: t.faint }]}>
        Private leagues for friends and family. Only people in a league see its board.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  foot: { fontFamily: FONT.body, fontSize: 13, marginTop: 28, lineHeight: 19 },
});
