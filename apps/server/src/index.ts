import { createApp } from './app';
import { loadConfig } from './config';
import { createGoogleAuth } from './gmail/google';
import { createMockSource } from './gmail/mock';
import { createLlmClient } from './llm/client';
import { createMemoryStore } from './store/memory';
import { createMongoStore } from './store/mongo';
import { createSyncRunner } from './sync';

const config = loadConfig();
const log = (msg: string) => console.log(`[sync] ${msg}`);

const store = config.MONGODB_URI
  ? await createMongoStore({ uri: config.MONGODB_URI, dbName: config.MONGODB_DB, trackingSince: config.TRACKING_SINCE })
  : createMemoryStore({ trackingSince: config.TRACKING_SINCE });
if (!config.MONGODB_URI) console.warn('MONGODB_URI not set: using the in-memory store, data is lost on restart.');

const google = config.GMAIL_MODE === 'google' ? createGoogleAuth(config, store) : null;
const source = google?.source ?? createMockSource({ dir: config.FIXTURES_DIR, rebaseDates: config.MOCK_REBASE_DATES });
const llm = createLlmClient(config);
console.log(`gmail=${source.mode} llm=${llm ? `live (${llm.model})` : 'mock'} store=${config.MONGODB_URI ? 'mongodb' : 'memory'}`);

const runSync = createSyncRunner({ store, source, llm, log });
const app = createApp({ config, store, source, llm, runSync, googleAuth: google?.auth });

app.listen(config.PORT, () => console.log(`GuiltFree server listening on :${config.PORT}`));

if (config.SYNC_INTERVAL_SECONDS > 0) {
  const tick = () => runSync().catch((err) => log(`sync failed: ${err.message}`));
  setTimeout(tick, 2000);
  setInterval(tick, config.SYNC_INTERVAL_SECONDS * 1000);
}
