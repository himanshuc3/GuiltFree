import type { LimitsUpdate, Order, Settings } from '@guiltfree/shared';
import type { KcalEntry } from '../llm/kcal';

export type EmailOutcome = 'ok' | 'skipped' | 'failed';

export interface SyncState {
  lastSyncAt?: string;
  lastError?: string | null;
}

export interface GoogleToken {
  refresh_token?: string | null;
  access_token?: string | null;
  expiry_date?: number | null;
}

export interface Store {
  /** Creates the singleton settings document on first call, stamping trackingSince. */
  getSettings(): Promise<Settings>;
  updateLimits(update: LimitsUpdate): Promise<Settings>;

  /** Returns true when the order was new. */
  upsertOrder(order: Order): Promise<boolean>;
  /** Newest first. */
  listOrders(opts?: { limit?: number }): Promise<Order[]>;
  listOrdersWithoutKcal(): Promise<Order[]>;

  getProcessedEmails(): Promise<Set<string>>;
  markEmail(messageId: string, outcome: EmailOutcome): Promise<void>;

  getKcal(normalizedNames: string[]): Promise<Record<string, KcalEntry>>;
  setKcal(entries: Record<string, KcalEntry>): Promise<void>;

  getGoogleToken(): Promise<GoogleToken | null>;
  setGoogleToken(token: GoogleToken): Promise<void>;

  getSyncState(): Promise<SyncState>;
  setSyncState(state: SyncState): Promise<void>;

  close(): Promise<void>;
}
