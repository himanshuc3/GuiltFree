import type { Order } from '@guiltfree/shared';
import type { EmailSource } from './gmail/types';
import type { LlmClient } from './llm/client';
import { extractBillWithLlm } from './llm/extractBill';
import { withKcal } from './llm/kcal';
import { buildOrder, parseSwiggyDelivered } from './parser/swiggyEmail';
import type { Store } from './store/types';

export interface SyncResult {
  fetched: number;
  inserted: number;
  skipped: number;
  failed: number;
  kcalRetried: number;
}

interface Deps {
  store: Store;
  source: EmailSource;
  llm: LlmClient | null;
  log?: (msg: string) => void;
}

/** Fetch new Swiggy emails, turn them into ledger orders, and fill in missing calorie estimates. */
export async function syncOnce({ store, source, llm, log = () => {} }: Deps): Promise<SyncResult> {
  const result: SyncResult = { fetched: 0, inserted: 0, skipped: 0, failed: 0, kcalRetried: 0 };
  const settings = await store.getSettings();
  const processed = await store.getProcessedEmails();

  const emails = await source.fetchSwiggyEmails(new Date(settings.trackingSince));
  result.fetched = emails.length;

  for (const email of emails) {
    if (processed.has(email.messageId)) continue;
    const emailDate = new Date(email.date);
    // Pre-install history is out of scope; the provider query may be coarser than our cutoff.
    if (emailDate.getTime() < Date.parse(settings.trackingSince)) continue;

    let parsed = parseSwiggyDelivered(email.html, emailDate);
    let order: Omit<Order, 'kcalTotal'> | null = null;

    if (parsed.ok) {
      order = { ...parsed.order, messageId: email.messageId };
    } else if (parsed.reason === 'not_a_swiggy_bill') {
      await store.markEmail(email.messageId, 'skipped');
      result.skipped++;
      continue;
    } else if (llm && parsed.meta && parsed.billText) {
      const bill = await extractBillWithLlm(llm, parsed.billText);
      if (bill) {
        order = { ...buildOrder(parsed.meta, bill, emailDate, 'llm'), messageId: email.messageId };
      }
    }

    if (!order) {
      log(`could not parse email ${email.messageId}: ${parsed.ok ? '' : parsed.reason}`);
      await store.markEmail(email.messageId, 'failed');
      result.failed++;
      continue;
    }

    let full: Order = order;
    try {
      full = await withKcal(order as Order, { store, llm });
    } catch (err) {
      // Keep the order; calories are retried below on the next sync.
      log(`calorie estimate failed for ${order.orderId}: ${(err as Error).message}`);
    }
    if (await store.upsertOrder(full)) result.inserted++;
    await store.markEmail(email.messageId, 'ok');
  }

  for (const order of await store.listOrdersWithoutKcal()) {
    try {
      await store.upsertOrder(await withKcal(order, { store, llm }));
      result.kcalRetried++;
    } catch (err) {
      log(`calorie retry failed for ${order.orderId}: ${(err as Error).message}`);
    }
  }
  return result;
}

/** Serialises syncs: concurrent callers share one in-flight run. */
export function createSyncRunner(deps: Deps): () => Promise<SyncResult> {
  let inFlight: Promise<SyncResult> | null = null;
  return () => {
    inFlight ??= (async () => {
      try {
        const result = await syncOnce(deps);
        await deps.store.setSyncState({ lastSyncAt: new Date().toISOString(), lastError: null });
        return result;
      } catch (err) {
        await deps.store.setSyncState({ lastSyncAt: new Date().toISOString(), lastError: (err as Error).message });
        throw err;
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  };
}
