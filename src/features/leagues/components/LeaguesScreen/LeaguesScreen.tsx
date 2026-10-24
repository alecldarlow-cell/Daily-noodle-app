import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { useTokens } from '@/shared/theme';
import { Screen } from '@/shared/ui';

import { useLeaguesFlow, type LeaguesParams } from '../../hooks/useLeaguesFlow';
import { useMine } from '../../hooks/useLeagues';
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

/**
 * Leagues: the player's daily boards, or an intro inviting them to start or join one.
 * Opened with `?join=<code>` (an invite) or `?go=claim|paste|start|code`.
 */
export function LeaguesScreen() {
  const t = useTokens();
  const params = useLocalSearchParams<{ join?: string; go?: string }>();
  const flow = useLeaguesFlow(params as LeaguesParams);
  const mine = useMine(true);
  const { view, league, pending } = flow;

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
    <Screen title="Leagues" testID="leagues-screen" onRefresh={() => void mine.refetch()}>
      {body}
      <Text style={[styles.foot, { color: t.faint }]}>
        Private leagues for friends and family. Only people in a league see its board.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  foot: { fontSize: 13, marginTop: 28, lineHeight: 19 },
});
