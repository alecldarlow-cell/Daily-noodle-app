import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSaveStore } from '@noodle/core';

import { createCachedStorage } from './cachedStorage';

/** The one store for the app, shared by every feature. */
export const appStorage = createCachedStorage(AsyncStorage, (key, error) => {
  console.warn(`Couldn't save ${key}`, error);
});

/** The site's save rules (first result kept, merges, notices) over the app's store. */
export const saves = createSaveStore(appStorage);
