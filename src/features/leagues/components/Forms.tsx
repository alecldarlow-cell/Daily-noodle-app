/* The intro and every form on the board page, in board.html's words ("browser" read as "app"). */
import type { BoardPending } from '@noodle/core';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { FONT, useTokens } from '@/shared/theme';
import { FieldLabel } from '@/shared/ui';

import { BoardError, SaidError } from '../api/errors';
import { useBoardState } from '../hooks/boardStore';
import { useImportLink } from '../hooks/useHandoff';
import { useForm } from '../hooks/useForm';
import type { Flow } from '../hooks/useLeaguesFlow';
import {
  useClaim,
  useCreateLeague,
  useJoinLeague,
  usePeek,
  useSetPin,
  useSettlePending,
} from '../hooks/useLeagues';
import {
  claimSchema,
  joinSchema,
  nicknameSchema,
  optionalPinSchema,
  pinSchema,
  startSchema,
} from '../schemas';
import { object } from 'yup';
import { Acts, B, Btn, Card, Field, Msg, P, PinField, TextLink } from './ui';

const PIN_HINT =
  'Lets you join as yourself from another phone or app later. Optional, and you can set it later.';

export function Intro({ flow }: { flow: Flow }) {
  const t = useTokens();
  return (
    <Card icon="🏆" title="Daily leaderboards for your group" testID="leagues-intro">
      <P>See how your family or friends did on each day’s puzzles. No sign-up, just a nickname.</P>
      {[
        'Start a league and give it a name.',
        'Share its link in your group chat.',
        'Everyone’s results appear on a board for each puzzle, every day.',
      ].map((s, i) => (
        <View key={s} style={styles.step}>
          <Text style={[styles.stepN, { backgroundColor: t.accentSoft, color: t.accent }]}>
            {i + 1}
          </Text>
          <Text style={[styles.stepText, { color: t.ink }]}>{s}</Text>
        </View>
      ))}
      <Acts>
        <Btn kind="go" label="Start a league" onPress={() => flow.setView({ k: 'start' })} />
        <Btn label="Join with a code" onPress={() => flow.setView({ k: 'code' })} />
      </Acts>
      <TextLink
        label="Already in a league on another browser or app?"
        onPress={() => flow.setView({ k: 'claim' })}
      />
    </Card>
  );
}

export function StartForm({ flow }: { flow: Flow }) {
  const create = useCreateLeague();
  const f = useForm({ name: '', nick: '', pin: '' }, startSchema);
  return (
    <Card title="Start a league" testID="start-form">
      <Field
        label="League name"
        testID="field-league-name"
        placeholder="e.g. Noodle family"
        maxLength={30}
        value={f.values.name}
        onChangeText={f.set('name')}
      />
      <Field
        label="Your nickname"
        testID="field-nickname"
        placeholder="e.g. Alec"
        maxLength={16}
        hint="What everyone in the league sees."
        value={f.values.nick}
        onChangeText={f.set('nick')}
      />
      <PinField hint={PIN_HINT} value={f.values.pin} onChangeText={f.set('pin')} />
      <Msg text={f.msg} />
      <Acts>
        <Btn
          kind="go"
          label="Start league"
          disabled={f.busy}
          onPress={() =>
            f.submit(async (v) => {
              const l = await create.mutateAsync({
                name: v.name,
                nick: v.nick,
                pin: v.pin || undefined,
              });
              flow.setNotice({ k: 'created', code: l.code });
              flow.home();
            })
          }
        />
        <Btn label="Back" onPress={flow.back} />
      </Acts>
    </Card>
  );
}

export function CodeForm({ flow }: { flow: Flow }) {
  const join = useJoinLeague();
  const f = useForm({ code: '', nick: '', pin: '' }, joinSchema);
  return (
    <Card title="Join a league" testID="code-form">
      <P>Ask someone in the league for its link or 8-letter code.</P>
      <Field
        label="League code"
        autoCapitalize="characters"
        autoCorrect={false}
        hint="Or paste the invite link."
        value={f.values.code}
        onChangeText={f.set('code')}
      />
      <Field
        label="Your nickname"
        maxLength={16}
        value={f.values.nick}
        onChangeText={f.set('nick')}
      />
      <PinField hint={PIN_HINT} value={f.values.pin} onChangeText={f.set('pin')} />
      <Msg text={f.msg} />
      <Acts>
        <Btn
          kind="go"
          label="Join"
          disabled={f.busy}
          onPress={() =>
            f.submit(async (v) => {
              await join.mutateAsync({ code: v.code, nick: v.nick, pin: v.pin || undefined });
              flow.setNotice({ k: 'joined' });
              flow.home();
            })
          }
        />
        <Btn label="Back" onPress={flow.back} />
      </Acts>
    </Card>
  );
}

/** Opened from a league's invite link: join it, or pick your name if you're already in it. */
export function InviteForm({ flow, code }: { flow: Flow; code: string }) {
  const t = useTokens();
  const peek = usePeek(code);
  const join = useJoinLeague();
  const f = useForm(
    { nick: '', pin: '' },
    object({ nick: nicknameSchema, pin: optionalPinSchema }),
  );
  if (peek.isPending)
    return (
      <ActivityIndicator
        style={styles.spin}
        color={t.muted}
        accessibilityLabel="Loading the invite"
      />
    );
  if (peek.isError || !peek.data) {
    return (
      <Card title="That link has expired" testID="invite-expired">
        <P>The league may have closed or changed its code. Ask for a new link.</P>
        <Acts>
          <Btn label="OK" onPress={flow.home} />
        </Acts>
      </Card>
    );
  }
  const info = peek.data;
  return (
    <Card title={`Join ${info.name}`} testID="invite-form">
      <P>
        {info.members} {info.members === 1 ? 'player' : 'players'} so far. Pick a nickname and your
        results will appear on the league’s daily boards.
      </P>
      <Field
        label="Your nickname"
        maxLength={16}
        value={f.values.nick}
        onChangeText={f.set('nick')}
      />
      <PinField hint={PIN_HINT} value={f.values.pin} onChangeText={f.set('pin')} />
      <Msg text={f.msg} />
      <Acts>
        <Btn
          kind="go"
          label="Join league"
          disabled={f.busy}
          onPress={() =>
            f.submit(async (v) => {
              try {
                await join.mutateAsync({ code, nick: v.nick, pin: v.pin || undefined });
              } catch (e) {
                if (e instanceof BoardError && e.code === 'nick_taken')
                  throw new SaidError(
                    `${e.message} If that’s you, tap “Already in ${info.name}?” below.`,
                  );
                throw e;
              }
              flow.setNotice({ k: 'joined' });
              flow.home();
            })
          }
        />
        {flow.inAny ? <Btn label="Not now" onPress={flow.home} /> : null}
      </Acts>
      {info.members ? (
        <TextLink
          label={`Already in ${info.name}? Pick your name`}
          onPress={() =>
            flow.setView({
              k: 'claim',
              code,
              name: info.name,
              players: info.players ?? [],
              back: { k: 'invite', code },
            })
          }
        />
      ) : null}
    </Card>
  );
}

export function ClaimForm({
  flow,
  code: known,
  name,
  players,
  back,
}: {
  flow: Flow;
  code?: string;
  name?: string;
  players?: string[];
  back?: Flow['view'];
}) {
  const t = useTokens();
  const claim = useClaim();
  const f = useForm({ code: known ?? '', nick: '', pin: '' }, claimSchema);
  const names = known && players && players.length ? players : null;
  return (
    <Card title={known ? `Already in ${name}?` : 'Already in a league?'} testID="claim-form">
      <P>
        Play as yourself in the app too: {known ? 'pick' : 'enter the league’s code and'} your
        nickname, and the PIN you set.
      </P>
      {known ? null : (
        <Field
          label="League code"
          autoCapitalize="characters"
          autoCorrect={false}
          hint="Or paste the league’s invite link."
          value={f.values.code}
          onChangeText={f.set('code')}
        />
      )}
      {names ? (
        <View>
          <FieldLabel>Your nickname</FieldLabel>
          <View style={styles.names} accessibilityRole="radiogroup">
            {names.map((n) => {
              const on = f.values.nick === n;
              return (
                <Pressable
                  key={n}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  onPress={() => f.set('nick')(n)}
                  style={[
                    styles.name,
                    {
                      borderColor: on ? t.accent : t.muted,
                      backgroundColor: on ? t.accentSoft : t.paper,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.nameText,
                      { color: t.ink, fontFamily: on ? FONT.bodyBold : FONT.body },
                    ]}>
                    {n}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : (
        <Field
          label="Your nickname"
          maxLength={16}
          value={f.values.nick}
          onChangeText={f.set('nick')}
        />
      )}
      <PinField
        label="Your PIN"
        hint="No PIN, or forgotten it? Ask the league’s owner to tap “Let back in” next to your name, then leave this blank."
        value={f.values.pin}
        onChangeText={f.set('pin')}
      />
      <Msg text={f.msg} />
      <Acts>
        <Btn
          kind="go"
          label="Play as me here"
          disabled={f.busy}
          onPress={() =>
            f.submit(async (v) => {
              const r = await claim.mutateAsync({ code: v.code, nick: v.nick, pin: v.pin });
              if (r.pending) {
                flow.setNeedPin(r.needsPin);
                flow.home();
              } else if (r.needsPin) flow.setView({ k: 'pin', fresh: true });
              else {
                flow.setNotice({ k: 'claimed', nick: r.nick });
                flow.home();
              }
            })
          }
        />
        <Btn label="Back" onPress={() => flow.setView(back ?? { k: 'home' })} />
      </Acts>
      <TextLink
        label="Have a personal link instead?"
        onPress={() => flow.setView({ k: 'paste' })}
      />
    </Card>
  );
}

export function PinForm({ flow, fresh }: { flow: Flow; fresh: boolean }) {
  const setPin = useSetPin();
  const f = useForm({ pin: '' }, object({ pin: pinSchema }));
  return (
    <Card title={fresh ? 'Set a new PIN' : 'Set your PIN'} testID="pin-form">
      <P>
        {fresh
          ? 'You’re back in. Choose a new PIN so you can do this yourself next time.'
          : 'Then you can join as yourself from another phone or app.'}
      </P>
      <PinField value={f.values.pin} onChangeText={f.set('pin')} />
      <Msg text={f.msg} />
      <Acts>
        <Btn
          kind="go"
          label="Save PIN"
          disabled={f.busy}
          onPress={() =>
            f.submit(async (v) => {
              await setPin.mutateAsync(v.pin);
              flow.setNotice({ k: 'pinSaved' });
              flow.home();
            })
          }
        />
        {fresh ? null : <Btn label="Back" onPress={flow.back} />}
      </Acts>
    </Card>
  );
}

export function PasteForm({ flow }: { flow: Flow }) {
  const bring = useImportLink();
  const f = useForm({ key: '' }, object({}));
  return (
    <Card title="Bring your leagues here" testID="paste-form">
      <P>
        Where you joined, open the board’s League settings and tap <B>Send me my link</B>. Copy that
        link and paste it below.
      </P>
      <Field
        label="Your link"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        spellCheck={false}
        value={f.values.key}
        onChangeText={f.set('key')}
      />
      <Msg text={f.msg} />
      <Acts>
        <Btn
          kind="go"
          label="Bring them here"
          disabled={f.busy}
          onPress={() =>
            f.submit(async (v) => {
              const r = await bring.mutateAsync(v.key);
              if (r.kind === 'moved') flow.setNotice({ k: 'moved' });
              flow.home();
            })
          }
        />
        <Btn label="Back" onPress={flow.back} />
      </Acts>
    </Card>
  );
}

/** This install plays as someone else, and a link or claim brought another player: ask. */
export function PendCard({ flow, pend }: { flow: Flow; pend: BoardPending }) {
  const s = useBoardState();
  const settle = useSettlePending();
  const names = (ls: { name: string; nick: string }[]) =>
    ls.map((l) => `${l.name} as ${l.nick}`).join(', ') || 'no leagues';
  // Decided before the change, since this card goes once the choice is saved.
  const choose = (take: boolean) => {
    if (take && flow.needPin) flow.setView({ k: 'pin', fresh: true });
    else if (take) flow.setNotice({ k: 'moved' });
    flow.setNeedPin(false);
    settle.mutate(take);
  };
  return (
    <Card title="Which leagues should this app use?" testID="pend-card">
      <P>Here you play in {names(s.leagues || [])}.</P>
      <P>Your link is for {names(pend.leagues || [])}.</P>
      <P>Results and streaks from the link have been added here either way.</P>
      <Acts>
        <Btn
          kind="go"
          label="Use my link"
          disabled={settle.isPending}
          onPress={() => choose(true)}
        />
        <Btn label="Keep this one" disabled={settle.isPending} onPress={() => choose(false)} />
      </Acts>
    </Card>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepN: {
    width: 23,
    height: 23,
    borderRadius: 12,
    textAlign: 'center',
    lineHeight: 23,
    fontSize: 12.5,
    fontFamily: FONT.bodyBold,
    overflow: 'hidden',
  },
  stepText: { flex: 1, fontFamily: FONT.body, fontSize: 15, lineHeight: 21 },
  spin: { marginTop: 40 },
  names: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  name: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  nameText: { fontSize: 15 },
});
