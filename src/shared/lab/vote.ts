/**
 * The Lab's one question (11 Nov 2026, project doc claude/lab-in-app-brief.md): after a Lab
 * puzzle, "Should <Name> go daily?", Yes or No, one tap. The answer is kept on the phone
 * (`noodle-lab-votes-v1`, the website's shape) and sent to the site's `lab_vote` with this
 * phone's own voter code (`noodle-lab-voter`, never the tracker's visitor code), or with the
 * player's sign-in when there is one, so one person counts once. Re-voting replaces the
 * answer. A vote that can't be sent is dropped: the answer on the phone still shows.
 */
import {
  LAB_VOTER_KEY,
  LAB_VOTES_KEY,
  readLabVotes,
  withLabVote,
  type LabType,
  type LabVote,
  type LabVotes,
} from '@noodle/core';
import { uuid } from 'expo';
import { useCallback } from 'react';

import { BUILD_ENV } from '@/shared/env';
import { appStorage, useStoredRaw, type CachedStorage } from '@/shared/storage';

type KV = Pick<CachedStorage, 'getItem' | 'setItem'>;

export interface VoteSenderDeps {
  env?: Readonly<Record<string, string | undefined>>;
  post?: typeof fetch;
  newId?: () => string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** This phone's voter code, made the first time it is needed. */
export function voterId(store: KV, newId: () => string = () => uuid.v4()): string {
  const had = store.getItem(LAB_VOTER_KEY);
  if (had && UUID.test(had)) return had;
  const id = newId();
  store.setItem(LAB_VOTER_KEY, id);
  return id;
}

/** Sends answers to public.lab_vote; silent when the build has no Supabase settings. */
export function createVoteSender({ env = BUILD_ENV, post = fetch, newId }: VoteSenderDeps = {}) {
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  let token: () => Promise<string | null> = () => Promise.resolve(null);
  return {
    /** Where the signed-in player's access token comes from (account feature, at start-up). */
    setToken(fn: () => Promise<string | null>): void {
      token = fn;
    },
    async send(store: KV, type: LabType, v: LabVote): Promise<boolean> {
      if (!url || !key) return false;
      try {
        const anon = voterId(store, newId);
        const bearer = await token().catch(() => null);
        const res = await post(`${url}/rest/v1/rpc/lab_vote`, {
          method: 'POST',
          headers: {
            apikey: key,
            'Content-Type': 'application/json',
            ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
          },
          body: JSON.stringify({
            p_anon: anon,
            p_type: type,
            p_vote: v === 'yes',
            p_source: 'app',
          }),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
  };
}

export const voteSender = createVoteSender();

/**
 * Keep `type`'s answer and send it. Nothing happens when the answer is already `v`.
 * Returns whether anything changed.
 */
export function castVote(
  type: LabType,
  v: LabVote,
  store: KV = appStorage,
  sender: Pick<ReturnType<typeof createVoteSender>, 'send'> = voteSender,
  now: number = Date.now(),
): boolean {
  const next = withLabVote(store.getItem(LAB_VOTES_KEY), type, v, now);
  if (!next) return false;
  store.setItem(LAB_VOTES_KEY, next);
  void sender.send(store, type, v);
  return true;
}

/** The answers given on this phone, re-rendering when one changes, and a way to give one. */
export function useLabVotes(store: CachedStorage = appStorage): {
  votes: LabVotes;
  vote: (type: LabType, v: LabVote) => void;
} {
  const raw = useStoredRaw(LAB_VOTES_KEY, store);
  const vote = useCallback((type: LabType, v: LabVote) => void castVote(type, v, store), [store]);
  return { votes: readLabVotes(raw), vote };
}
