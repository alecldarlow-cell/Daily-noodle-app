/**
 * Results to the boards: every finished puzzle goes up as it ends (members only; the
 * server keeps the first result), and the puzzles this install already remembers are
 * copied in when it has more than last time (dn-board.js backfill).
 */
import {
  afterBackfill,
  backfillCalls,
  backfillPlan,
  dateOfPath,
  inAnyLeague,
  submitArgs,
  type BackfillPlan,
  type FeedPath,
} from '@noodle/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { onFinish, type PuzzleFinish } from '@/shared/results';
import { appStorage } from '@/shared/storage';

import { boardBackfill, boardSubmit } from '../api/board';
import { fetchPuzzleCards } from '../api/feed';
import { getPid, loadBoard, saveBoard, stillPlayer } from './boardStore';
import { recordSubmission } from './submissions';
import { BOARD_QUERY } from './useLeagues';

/** board_submit's arguments for a finish, or null when nothing is sent. */
export function submitFor(f: PuzzleFinish) {
  if (!inAnyLeague(appStorage)) return null;
  return submitArgs(getPid(), f.path, f.detail);
}

/** Listen for finished puzzles for as long as the app runs, and post each to the boards. */
export function useSubmitFinishes(): void {
  const qc = useQueryClient();
  const submit = useMutation({
    mutationFn: boardSubmit,
    onSuccess: () => qc.invalidateQueries({ queryKey: BOARD_QUERY }),
    // As the site: a result that can't be sent is let go (the history copy sends it later).
    onError: () => {},
  });
  const { mutateAsync } = submit;
  useEffect(
    () =>
      onFinish((f) => {
        const args = submitFor(f);
        // Kept per path, so the finish sheet's board slot waits for it (dn-board.js `submitted`).
        if (args) recordSubmission(args.p_path, mutateAsync(args));
      }),
    [mutateAsync],
  );
}

/**
 * Run a backfill plan's calls in order as the player it started for, then save how far it
 * got (unless the install has adopted another player meanwhile). Returns rows added.
 */
export async function runBackfill(plan: BackfillPlan): Promise<number> {
  const pid = getPid();
  let total = 0;
  for (const c of backfillCalls(plan)) {
    total += Number(await boardBackfill(pid, c.aid, c.rows)) || 0;
  }
  // A backfill for a player the install has since left is not recorded on the new one.
  if (stillPlayer(pid)) saveBoard(afterBackfill(loadBoard(), plan));
  return total;
}

/** A catch-up sends results from this many days back: enough for a spell with no signal. */
export const CATCH_UP_DAYS = 14;
/** And looks at most this often. */
export const CATCH_UP_EVERY_MS = 10 * 60_000;

/** The plan with only its recent rows: the full history goes when the board opens. */
export function recentOnly(plan: BackfillPlan, now: number): BackfillPlan {
  const from = new Date(now - CATCH_UP_DAYS * 864e5).toISOString().slice(0, 10);
  return { ...plan, rows: plan.rows.filter((r) => dateOfPath(r.path) >= from) };
}

/**
 * A result that couldn't be sent when its puzzle ended (no signal) goes up the next time the
 * app opens or comes back, without the player having to open Leagues, so their league sees it.
 */
export function useCatchUp(now: () => number = Date.now): void {
  const qc = useQueryClient();
  useEffect(() => {
    let last = 0;
    let busy = false;
    const go = () => {
      if (busy || now() - last < CATCH_UP_EVERY_MS || !inAnyLeague(appStorage)) return;
      last = now();
      busy = true;
      void fetchPuzzleCards()
        .then(async (feed) => {
          const plan = backfillPlan(appStorage, feed);
          if (!plan) return;
          await runBackfill(recentOnly(plan, now()));
          await qc.invalidateQueries({ queryKey: BOARD_QUERY });
        })
        .catch(() => undefined) // no signal: the next return tries again
        .finally(() => {
          busy = false;
        });
    };
    go();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') go();
    });
    return () => sub.remove();
  }, [qc, now]);
}

/**
 * Copy this install's earlier results in when it's due, once the puzzle pages are known
 * (`feed` undefined = still loading). `filling` while it runs; failures wait for next time.
 */
export function useBackfill(enabled: boolean, feed: readonly FeedPath[] | undefined, pid?: string) {
  const qc = useQueryClient();
  const run = useMutation({
    mutationFn: (v: { plan: BackfillPlan; key: string }) => runBackfill(v.plan),
    onSettled: () => qc.invalidateQueries({ queryKey: BOARD_QUERY }),
  });
  const due = enabled && feed !== undefined ? backfillPlan(appStorage, feed) : null;
  // One try per plan: a plan that failed waits until there is more to copy, or next launch.
  const key = due ? `${pid}|${due.n}|${due.aids.join(',')}` : null;
  const tried = run.variables?.key === key;
  const { mutate, isPending } = run;
  useEffect(() => {
    if (!due || !key || isPending || tried) return;
    mutate({ plan: due, key });
  }, [due, key, isPending, tried, mutate]);
  return { filling: isPending || (!!key && !tried) };
}
