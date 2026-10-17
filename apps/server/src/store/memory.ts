import type { LimitsUpdate, Order, Settings } from '@guiltfree/shared';
import type { KcalEntry } from '../llm/kcal';
import type { EmailOutcome, GoogleToken, Store, SyncState } from './types';

/** In-memory store for tests and for running without MongoDB. Data is lost on restart. */
export function createMemoryStore(opts: { trackingSince?: string } = {}): Store {
  let settings: Settings | null = null;
  const orders = new Map<string, Order>();
  const emails = new Map<string, EmailOutcome>();
  const kcal = new Map<string, KcalEntry>();
  let token: GoogleToken | null = null;
  let sync: SyncState = {};

  const newestFirst = () =>
    [...orders.values()].sort((a, b) => b.deliveredAt.localeCompare(a.deliveredAt));

  const ensureSettings = (): Settings =>
    (settings ??= {
      limits: { weekly: {}, monthly: {} },
      trackingSince: opts.trackingSince ?? new Date().toISOString(),
    });

  return {
    async getSettings() {
      return structuredClone(ensureSettings());
    },
    async updateLimits(update: LimitsUpdate) {
      const s = ensureSettings();
      if (update.weekly) s.limits.weekly = update.weekly;
      if (update.monthly) s.limits.monthly = update.monthly;
      return structuredClone(s);
    },
    async upsertOrder(order) {
      const isNew = !orders.has(order.orderId);
      orders.set(order.orderId, structuredClone(order));
      return isNew;
    },
    async listOrders({ limit } = {}) {
      return structuredClone(limit ? newestFirst().slice(0, limit) : newestFirst());
    },
    async listOrdersWithoutKcal() {
      return structuredClone(newestFirst().filter((o) => o.kcalTotal === undefined));
    },
    async getProcessedEmails() {
      return new Set(emails.keys());
    },
    async markEmail(id, outcome) {
      emails.set(id, outcome);
    },
    async getKcal(names) {
      return Object.fromEntries(names.filter((n) => kcal.has(n)).map((n) => [n, kcal.get(n)!]));
    },
    async setKcal(entries) {
      for (const [k, v] of Object.entries(entries)) kcal.set(k, v);
    },
    async getGoogleToken() {
      return token;
    },
    async setGoogleToken(t) {
      token = t;
    },
    async getSyncState() {
      return { ...sync };
    },
    async setSyncState(s) {
      sync = { ...sync, ...s };
    },
    async close() {},
  };
}
