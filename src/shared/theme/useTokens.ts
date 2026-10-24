import { useColorScheme } from 'react-native';

import { tokensFor, type Tokens } from './tokens';

/** The house tokens for the phone's current light or dark setting. */
export function useTokens(): Tokens {
  return tokensFor(useColorScheme());
}
