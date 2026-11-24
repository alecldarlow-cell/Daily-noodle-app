/* League settings, opened from the league menu: invite, you, players, report, and the owner's tools. */
import type { BoardLeague } from '@noodle/core';
import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { FONT, useTokens } from '@/shared/theme';
import { Button } from '@/shared/ui';

import { sayError } from '../api/errors';
import type { Flow } from '../hooks/useLeaguesFlow';
import { useLeaveLeague, useOwnerAction } from '../hooks/useLeagues';
import { leagueNameSchema, firstError } from '../schemas';
import { syncOn } from './boardShared';
import { Acts, B, Btn, Field, Msg, P, Sub } from './ui';

/** Confirm with the phone's own dialog, as the site's confirm(). */
/** Report (8 Nov 2026): an email to us with the league and the name filled in, as board.html's. */
export function reportUrl(league: BoardLeague, nick: string): string {
  const body =
    `League: ${league.name} (code ${league.code})\n` +
    (nick ? `Name I’m reporting: ${nick}\n` : 'What I’m reporting: \n') +
    'Why: \n';
  return `mailto:contact@dailynoodle.co.uk?subject=${encodeURIComponent(`Report a name in ${league.name}`)}&body=${encodeURIComponent(body)}`;
}

function confirm(title: string, message: string, ok: string, then: () => void) {
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: ok, style: 'destructive', onPress: then },
  ]);
}

export function Settings({
  flow,
  league,
  players,
  members,
  hidden = [],
  onHide = () => {},
  onClose,
}: {
  flow: Flow;
  league: BoardLeague;
  players: string[];
  members: number;
  /** Players hidden on this phone (8 Nov 2026), and the switch. */
  hidden?: readonly string[];
  onHide?: (nick: string, on: boolean) => void;
  onClose: () => void;
}) {
  const t = useTokens();
  const [name, setName] = useState(league.name);
  const [msg, setMsg] = useState<{ text: string; ok?: boolean }>({ text: '' });
  // Another league picked: its own name in the rename box, and no message left from the
  // last one (else Save would rename this league to the other's name).
  const [forCode, setForCode] = useState(league.code);
  if (forCode !== league.code) {
    setForCode(league.code);
    setName(league.name);
    setMsg({ text: '' });
  }
  const leave = useLeaveLeague();
  const owner = useOwnerAction();
  const fail = (e: unknown) => setMsg({ text: sayError(e) });
  return (
    <View
      style={[styles.settings, { backgroundColor: t.paper, borderColor: t.hair }]}
      testID="league-settings">
      <View style={styles.settingsHead}>
        <Text accessibilityRole="header" style={[styles.settingsTitle, { color: t.ink }]}>
          League settings
        </Text>
        <Button variant="text" label="Done" onPress={onClose} testID="settings-done" />
      </View>
      {
        <View>
          <Sub>Invite</Sub>
          <P>
            Code <Text style={styles.code}>{league.code}</Text> · {members}{' '}
            {members === 1 ? 'player' : 'players'}
          </P>
          <Sub>Another group?</Sub>
          <P>
            Start a separate league for friends, work or another chat. You can be in more than one.
          </P>
          <Acts>
            <Btn
              label="Start another league"
              onPress={() => flow.setView({ k: 'start', from: 'settings' })}
            />
          </Acts>
          <Sub>You</Sub>
          <P>
            Playing as <B>{league.nick}</B>
          </P>
          <Acts>
            <Btn label="Change nickname" onPress={() => flow.setView({ k: 'nick' })} />
            <Btn
              variant="tonal"
              destructive
              label="Leave league"
              onPress={() =>
                confirm(
                  'Leave league',
                  `Leave ${league.name}? You’ll come off its boards. You can rejoin with the link.`,
                  'Leave',
                  () => leave.mutate(league.code, { onError: fail }),
                )
              }
            />
          </Acts>
          {!league.owner && players.some((p) => p !== league.nick) ? (
            <>
              <Sub>Players</Sub>
              {players
                .filter((p) => p !== league.nick)
                .map((p) => {
                  const off = hidden.includes(p);
                  return (
                    <View key={p} style={[styles.plist, { borderBottomColor: t.hair }]}>
                      <Text style={[styles.plistName, { color: t.ink }]}>
                        {p}
                        {off ? ' (hidden)' : ''}
                      </Text>
                      <View style={styles.plistActs}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${off ? 'Show' : 'Hide'} ${p}`}
                          testID={`hide-${p}`}
                          style={styles.plistHit}
                          onPress={() => onHide(p, !off)}>
                          <Text style={[styles.plistBtn, { color: t.faint }]}>
                            {off ? 'Show' : 'Hide'}
                          </Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="link"
                          accessibilityLabel={`Report ${p}`}
                          testID={`report-${p}`}
                          style={styles.plistHit}
                          onPress={() =>
                            void Linking.openURL(reportUrl(league, p)).catch(() => undefined)
                          }>
                          <Text style={[styles.plistBtn, { color: t.accent }]}>Report</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              <P fine>
                Hide takes a player off your boards on this phone only. Report emails us; we read
                every report.
              </P>
            </>
          ) : null}
          <Sub>Something not right?</Sub>
          <P>
            A rude name or league name?{' '}
            <Text
              accessibilityRole="link"
              testID="report-league"
              style={{ color: t.accent, textDecorationLine: 'underline' }}
              onPress={() => void Linking.openURL(reportUrl(league, '')).catch(() => undefined)}>
              Report it to us
            </Text>
            {league.owner ? ', or remove the player below.' : '.'}
          </P>
          <Sub>Play somewhere else too?</Sub>
          <P>
            {syncOn()
              ? 'Your leagues are kept in this app. Sign in on Account with your email, and your leagues and streaks follow you.'
              : 'Your leagues are kept in this app.'}
          </P>
          {league.owner ? (
            <>
              <Sub>League name</Sub>
              <Field
                label="League name"
                testID="settings-league-name"
                maxLength={30}
                value={name}
                onChangeText={setName}
              />
              <Acts>
                <Btn
                  label="Save"
                  onPress={() => {
                    const problem = firstError(leagueNameSchema, name);
                    if (problem) return setMsg({ text: problem });
                    owner.mutate(
                      {
                        act: 'rename',
                        code: league.code,
                        name: leagueNameSchema.cast(name) as string,
                      },
                      { onSuccess: () => setMsg({ ok: true, text: 'Saved.' }), onError: fail },
                    );
                  }}
                />
              </Acts>
              <Sub>Players</Sub>
              {players.map((p) => (
                <View key={p} style={[styles.plist, { borderBottomColor: t.hair }]}>
                  <Text style={[styles.plistName, { color: t.ink }]}>
                    {p}
                    {p === league.nick ? ' (you)' : ''}
                  </Text>
                  {p === league.nick ? null : (
                    <View style={styles.plistActs}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Let ${p} back in`}
                        style={styles.plistHit}
                        onPress={() =>
                          owner.mutate(
                            { act: 'let_back', code: league.code, nick: p },
                            {
                              onSuccess: (ok) =>
                                setMsg({
                                  ok: true,
                                  text: ok
                                    ? `${p} can join from another phone or app without a PIN for the next day: ask them to open the league link and tap “Already in this league?”.`
                                    : `Couldn’t find ${p}.`,
                                }),
                              onError: fail,
                            },
                          )
                        }>
                        <Text style={[styles.plistBtn, { color: t.accent }]}>Let back in</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${p}`}
                        style={styles.plistHit}
                        onPress={() =>
                          confirm(
                            'Remove player',
                            `Remove ${p} from ${league.name}? They come off its boards. They could rejoin with the link unless you make a new join code.`,
                            'Remove',
                            () =>
                              owner.mutate(
                                { act: 'remove', code: league.code, nick: p },
                                { onError: fail },
                              ),
                          )
                        }>
                        <Text style={[styles.plistBtn, { color: t.bad }]}>Remove</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ))}
              <P fine>
                Let back in: for a day, that player can join as themselves from another phone or app
                without a PIN.
              </P>
              <Sub>Join code</Sub>
              <P>A new code stops the old link and code working; everyone already in stays in.</P>
              <Acts>
                <Btn
                  label="New join code"
                  onPress={() =>
                    confirm(
                      'New join code',
                      'Make a new join code? The old link and code stop working; people already in the league stay in.',
                      'Make new code',
                      () => owner.mutate({ act: 'new_code', code: league.code }, { onError: fail }),
                    )
                  }
                />
              </Acts>
              <Sub>Close league</Sub>
              <P>Takes the league off everyone’s boards.</P>
              <Acts>
                <Btn
                  variant="tonal"
                  destructive
                  label="Close league"
                  onPress={() =>
                    confirm(
                      'Close league',
                      `Close ${league.name} for everyone? It comes off all its players’ boards.`,
                      'Close',
                      () => owner.mutate({ act: 'close', code: league.code }, { onError: fail }),
                    )
                  }
                />
              </Acts>
            </>
          ) : null}
          <Msg text={msg.text} ok={msg.ok} />
        </View>
      }
    </View>
  );
}

const styles = StyleSheet.create({
  // Opened from the league menu, at the top of the board until Done.
  settings: { marginBottom: 16, borderWidth: 1, borderRadius: 12, padding: 16 },
  settingsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingsTitle: { fontFamily: FONT.displayHeavy, fontSize: 18 },
  code: { fontFamily: FONT.display, letterSpacing: 1.6 },
  plist: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
    borderBottomWidth: 1,
  },
  plistName: { fontFamily: FONT.body, fontSize: 15, flexShrink: 1 },
  plistActs: { flexDirection: 'row', gap: 8 },
  plistHit: { minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: 8 },
  plistBtn: { fontFamily: FONT.bodySemi, fontSize: 14 },
});
