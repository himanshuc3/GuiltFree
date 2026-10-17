import type { Settings } from './schemas';
import type { Status } from './rules';

/** GET /status response, shared so the server and the app cannot drift apart. */
export interface StatusResponse {
  now: string;
  settings: Settings;
  status: Status;
  gmail: { mode: 'mock' | 'google'; connected: boolean };
  llm: { mode: 'live' | 'mock'; model: string | null };
  sync: { lastSyncAt?: string; lastError?: string | null };
}
