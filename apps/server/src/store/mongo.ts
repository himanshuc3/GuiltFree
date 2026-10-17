import { MongoClient } from 'mongodb';
import type { LimitsUpdate, Order, Settings } from '@guiltfree/shared';
import type { KcalEntry } from '../llm/kcal';
import type { EmailOutcome, GoogleToken, Store, SyncState } from './types';

type SettingsDoc = Settings & { _id: 'main' };
type EmailDoc = { _id: string; outcome: EmailOutcome; at: string };
type KcalDoc = KcalEntry & { _id: string };
type KvDoc<T> = { _id: string } & T;

const NO_ID = { projection: { _id: 0 } } as const;

export async function createMongoStore(opts: {
  uri: string;
  dbName: string;
  trackingSince?: string;
}): Promise<Store> {
  const client = new MongoClient(opts.uri);
  await client.connect();
  const db = client.db(opts.dbName);

  const orders = db.collection<Order>('orders');
  const settings = db.collection<SettingsDoc>('settings');
  const emails = db.collection<EmailDoc>('emails');
  const kcal = db.collection<KcalDoc>('kcalCache');
  const kv = db.collection<KvDoc<Record<string, unknown>>>('kv');

  // orderId is the natural key: re-polling the same email must never double count.
  await orders.createIndex({ orderId: 1 }, { unique: true });
  await orders.createIndex({ deliveredAt: -1 });

  const getSettings = async (): Promise<Settings> => {
    const doc = await settings.findOneAndUpdate(
      { _id: 'main' },
      {
        $setOnInsert: {
          limits: { weekly: {}, monthly: {} },
          trackingSince: opts.trackingSince ?? new Date().toISOString(),
        },
      },
      { upsert: true, returnDocument: 'after', projection: { _id: 0 } },
    );
    return doc as unknown as Settings;
  };

  const getSyncState = async (): Promise<SyncState> => {
    const doc = await kv.findOne({ _id: 'syncState' });
    return doc ? (doc.value as SyncState) : {};
  };

  return {
    getSettings,
    async updateLimits(update: LimitsUpdate) {
      await getSettings();
      const $set: Record<string, unknown> = {};
      if (update.weekly) $set['limits.weekly'] = update.weekly;
      if (update.monthly) $set['limits.monthly'] = update.monthly;
      if (Object.keys($set).length) await settings.updateOne({ _id: 'main' }, { $set });
      return getSettings();
    },
    async upsertOrder(order) {
      const res = await orders.updateOne({ orderId: order.orderId }, { $set: order }, { upsert: true });
      return res.upsertedCount === 1;
    },
    async listOrders({ limit } = {}) {
      const cursor = orders.find({}, NO_ID).sort({ deliveredAt: -1 });
      return (limit ? cursor.limit(limit) : cursor).toArray() as Promise<Order[]>;
    },
    async listOrdersWithoutKcal() {
      return orders.find({ kcalTotal: { $exists: false } }, NO_ID).sort({ deliveredAt: -1 }).toArray() as Promise<Order[]>;
    },
    async getProcessedEmails() {
      return new Set((await emails.find({}, { projection: { _id: 1 } }).toArray()).map((d) => d._id));
    },
    async markEmail(id, outcome) {
      await emails.updateOne({ _id: id }, { $set: { outcome, at: new Date().toISOString() } }, { upsert: true });
    },
    async getKcal(names) {
      if (!names.length) return {};
      const docs = await kcal.find({ _id: { $in: names } }).toArray();
      return Object.fromEntries(docs.map((d) => [d._id, { kcalPerUnit: d.kcalPerUnit, source: d.source }]));
    },
    async setKcal(entries) {
      const ops = Object.entries(entries).map(([_id, v]) => ({
        updateOne: { filter: { _id }, update: { $set: v }, upsert: true },
      }));
      if (ops.length) await kcal.bulkWrite(ops);
    },
    async getGoogleToken() {
      const doc = await kv.findOne({ _id: 'googleToken' });
      return doc ? (doc.value as GoogleToken) : null;
    },
    async setGoogleToken(token) {
      await kv.updateOne({ _id: 'googleToken' }, { $set: { value: token } }, { upsert: true });
    },
    getSyncState,
    async setSyncState(state) {
      const current = await getSyncState();
      await kv.updateOne({ _id: 'syncState' }, { $set: { value: { ...current, ...state } } }, { upsert: true });
    },
    async close() {
      await client.close();
    },
  };
}
