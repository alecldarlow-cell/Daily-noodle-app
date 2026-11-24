/* What the board's parts share: the records context, the share sheet and the sync switch. */
import { createContext } from 'react';
import { Share } from 'react-native';

import { BUILD_ENV } from '@/shared/env';

import type { Records } from '../types';

/** Sign-in sync is in this build: then joining points to it, for playing on another phone. */
export const syncOn = (): boolean => BUILD_ENV.EXPO_PUBLIC_SYNC === '1';

/**
 * The league's records, read alongside every view as the site does (loadRecords): for
 * "🏆 New league record" on a row, the record line under a
 * day's board, and a name's card on a tap. Absent until they load, or if they can't.
 */
export const RecordsCtx = createContext<{ recs?: Records; open?: (nick: string) => void }>({});

export const share = (message: string) => Share.share({ message }).catch(() => {});
