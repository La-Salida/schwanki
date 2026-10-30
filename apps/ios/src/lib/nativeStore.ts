import { openDatabaseAsync } from 'expo-sqlite';
import { ReviewStore } from './storage';
let pending: Promise<ReviewStore> | undefined;
export function getStore() {
  pending ??= openDatabaseAsync('schwanki-v1.db').then(async db => {
    const store = new ReviewStore(db); await store.initialize(); return store;
  }).catch(error => { pending = undefined; throw error; });
  return pending;
}
