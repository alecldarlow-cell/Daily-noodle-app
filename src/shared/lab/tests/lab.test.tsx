/** The Lab's shared parts (11 Nov 2026): the vote, the trials list, the start and finish. */
import { LAB_VOTER_KEY, LAB_VOTES_KEY, londonDay, dayBefore } from '@noodle/core';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { Share, Text } from 'react-native';

import type { LabFeedItem } from '@/shared/feed';
import { appStorage } from '@/shared/storage';
import { renderWithProviders } from '@/shared/testing';

import { LAB_FOOT, LabFinishSheet } from '../LabFinishSheet';
import { LabStartCard } from '../LabStartCard';
import { VOTE_ASK, VOTE_THANKS } from '../LabVoteBlock';
import { labTrials, nextTrial } from '../trials';
import { castVote, createVoteSender, voterId, voteSender } from '../vote';

const ENV = {
  EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'k',
};
const kv = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    m,
  };
};
const item = (type: LabFeedItem['type'], date: string, n: number): LabFeedItem => ({
  path: `reports/${date}-${type}-${n}.html`,
  type,
  id: `DP·${type === 'tilt' ? 'TILT' : type === 'redact' ? 'REDA' : 'TUMB'}·${String(n).padStart(4, '0')}`,
  date,
  headline: `${type} ${n}`,
  standfirst: '',
  read: '',
  mask: '',
  json: null,
});

beforeEach(() => {
  for (const k of appStorage.keys()) appStorage.setItem(k, 'null');
  jest.restoreAllMocks();
});

describe('GIVEN the vote sender', () => {
  it('WHEN a vote is sent THEN it goes to lab_vote with this phone’s own voter code', async () => {
    const post = jest.fn().mockResolvedValue({ ok: true });
    const s = createVoteSender({
      env: ENV,
      post,
      newId: () => '00000000-0000-4000-8000-000000000001',
    });
    const store = kv();
    expect(await s.send(store, 'redact', 'yes')).toBe(true);
    const [url, init] = post.mock.calls[0]!;
    expect(url).toBe('https://x.supabase.co/rest/v1/rpc/lab_vote');
    expect(init.headers).toEqual({ apikey: 'k', 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual({
      p_anon: '00000000-0000-4000-8000-000000000001',
      p_type: 'redact',
      p_vote: true,
      p_source: 'app',
    });
    // the code is kept and reused
    expect(store.m.get(LAB_VOTER_KEY)).toBe('00000000-0000-4000-8000-000000000001');
    await s.send(store, 'redact', 'no');
    expect(JSON.parse(post.mock.calls[1]![1].body).p_anon).toBe(
      '00000000-0000-4000-8000-000000000001',
    );
  });
  it('WHEN signed in THEN the token goes with it', async () => {
    const post = jest.fn().mockResolvedValue({ ok: true });
    const s = createVoteSender({ env: ENV, post });
    s.setToken(() => Promise.resolve('tok'));
    await s.send(kv(), 'tilt', 'no');
    expect(post.mock.calls[0]![1].headers.Authorization).toBe('Bearer tok');
  });
  it('WHEN the token fails, the post fails, or the build has no settings THEN it gives up quietly', async () => {
    const s = createVoteSender({ env: ENV, post: jest.fn().mockRejectedValue(new Error('x')) });
    s.setToken(() => Promise.reject(new Error('no')));
    expect(await s.send(kv(), 'tilt', 'no')).toBe(false);
    const off = createVoteSender({ env: {}, post: jest.fn() });
    expect(await off.send(kv(), 'tilt', 'no')).toBe(false);
  });
  it('WHEN a kept code is malformed THEN a new one is made', () => {
    const store = kv({ [LAB_VOTER_KEY]: 'nope' });
    expect(voterId(store, () => '00000000-0000-4000-8000-00000000000f')).toBe(
      '00000000-0000-4000-8000-00000000000f',
    );
  });
});

describe('GIVEN an answer', () => {
  it('WHEN it is cast THEN it is kept and sent once; the same answer again does nothing', () => {
    const store = kv();
    const sender = { send: jest.fn().mockResolvedValue(true) };
    expect(castVote('tumbler', 'yes', store, sender, 5)).toBe(true);
    expect(JSON.parse(store.m.get(LAB_VOTES_KEY)!)).toEqual({ tumbler: { v: 'yes', at: 5 } });
    expect(castVote('tumbler', 'yes', store, sender, 6)).toBe(false);
    expect(sender.send).toHaveBeenCalledTimes(1);
  });
});

describe('GIVEN the Lab’s puzzles', () => {
  const today = '2026-11-20';
  const list = [
    item('redact', '2026-11-21', 36), // tomorrow: not yet
    item('redact', today, 35),
    item('tumbler', '2026-11-19', 34),
    item('tilt', '2026-11-10', 20),
    item('redact', '2026-11-19', 34),
  ];
  it('THEN running trials are listed in the Lab’s order with their newest, retired ones apart', () => {
    const tr = labTrials(list, today);
    expect(tr.current.map((it) => it.id)).toEqual(['DP·REDA·0035', 'DP·TUMB·0034']);
    expect([...tr.retired]).toEqual(['tilt']);
    expect(tr.all.map((it) => it.id)).toEqual([
      'DP·REDA·0035',
      'DP·REDA·0034',
      'DP·TUMB·0034',
      'DP·TILT·0020',
    ]);
  });
  it('THEN the next trial is the next running one not yet played, wrapping, never itself', () => {
    const cur = [item('tilt', today, 1), item('redact', today, 2), item('tumbler', today, 3)];
    expect(nextTrial(cur, 'redact', () => false)?.type).toBe('tumbler');
    expect(nextTrial(cur, 'tumbler', () => false)?.type).toBe('tilt');
    expect(nextTrial(cur, 'tumbler', (it) => it.type === 'tilt')?.type).toBe('redact');
    expect(nextTrial(cur, 'tilt', () => true)).toBeNull();
    expect(nextTrial([], 'tilt', () => false)).toBeNull();
  });
});

describe('GIVEN a Lab puzzle finished', () => {
  const props = {
    type: 'redact' as const,
    n: 35,
    date: londonDay(),
    path: 'reports/x-word-redact-0035.html',
    title: 'Solved',
    hero: '2:48',
    note: 'Right first time at the full count.',
    share: '⬛ Redact #35 — 2:48',
    recap: { title: 'The crossword', sub: 'Six black squares.', node: <Text>grid</Text> },
    onBack: jest.fn(),
    onNext: jest.fn(),
  };
  it('WHEN the sheet shows THEN it asks the one question and says it is a trial', async () => {
    const next = item('tumbler', londonDay(), 3);
    await renderWithProviders(<LabFinishSheet {...props} next={next} celebrate />);
    expect(screen.getByText('Should Redact go daily?')).toBeOnTheScreen();
    expect(screen.getByTestId('lab-vote-note')).toHaveTextContent(VOTE_ASK);
    expect(screen.getByTestId('lab-hero')).toHaveTextContent('2:48');
    expect(screen.getByTestId('lab-kicker')).toHaveTextContent('REDACT 35');
    expect(screen.getByTestId('lab-foot')).toHaveTextContent(LAB_FOOT);
    expect(screen.getByText('THE CROSSWORD')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('lab-next'));
    expect(props.onNext).toHaveBeenCalledWith(next);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });
  });
  it('WHEN Yes is tapped, then No THEN the answer is kept and shown, and sent each time', async () => {
    const send = jest.spyOn(voteSender, 'send').mockResolvedValue(true);
    await renderWithProviders(
      <LabFinishSheet {...props} date={dayBefore(londonDay())} next={null} />,
    );
    expect(screen.queryByTestId('lab-next')).toBeNull();
    expect(screen.getByTestId('lab-kicker')).toHaveTextContent(/·/); // an earlier day says when
    await fireEvent.press(screen.getByTestId('lab-vote-yes'));
    expect(screen.getByTestId('lab-vote-yes').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('lab-vote-note')).toHaveTextContent(VOTE_THANKS);
    await fireEvent.press(screen.getByTestId('lab-vote-no'));
    expect(screen.getByTestId('lab-vote-no').props.accessibilityState.selected).toBe(true);
    expect(JSON.parse(appStorage.getItem(LAB_VOTES_KEY)!).redact.v).toBe('no');
    expect(send.mock.calls.map((c) => [c[1], c[2]])).toEqual([
      ['redact', 'yes'],
      ['redact', 'no'],
    ]);
  });
  it('WHEN Share is tapped THEN the line goes with the page’s address', async () => {
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    await renderWithProviders(<LabFinishSheet {...props} next={null} />);
    await fireEvent.press(screen.getByTestId('lab-share'));
    expect(share).toHaveBeenCalledWith({
      message: '⬛ Redact #35 — 2:48\ndailynoodle.co.uk/reports/x-word-redact-0035.html',
    });
  });
});

describe('GIVEN a Lab puzzle not yet played', () => {
  it('THEN its start card shows the line, how many played, and the trial note in How to play', async () => {
    const onPlay = jest.fn();
    await renderWithProviders(
      <LabStartCard
        type="tumbler"
        n={35}
        date={londonDay()}
        line="Spin the wheels."
        how={['Line up a word.']}
        played={4}
        onPlay={onPlay}
        onBack={jest.fn()}
      />,
    );
    expect(screen.getByText('Tumbler')).toBeOnTheScreen();
    expect(screen.getByText('Spin the wheels.')).toBeOnTheScreen();
    expect(screen.getByText(/Lab trial No\. 35/)).toBeOnTheScreen();
    expect(screen.getByText('words found')).toBeOnTheScreen(); // the website's wording (house.js)
    await fireEvent.press(screen.getByRole('button', { name: 'Play' }));
    expect(onPlay).toHaveBeenCalled();
  });
});
