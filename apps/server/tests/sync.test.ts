import { describe, expect, it, vi } from 'vitest';
import type { EmailSource, RawEmail } from '../src/gmail/types';
import type { LlmClient } from '../src/llm/client';
import { estimateKcal, mockKcal, normalizeName } from '../src/llm/kcal';
import { createMemoryStore } from '../src/store/memory';
import { createSyncRunner, syncOnce } from '../src/sync';
import { billHtml, fixture } from './helpers';

const sourceOf = (emails: RawEmail[]): EmailSource => ({
  mode: 'mock',
  isConnected: async () => true,
  fetchSwiggyEmails: async (since) => emails.filter((e) => Date.parse(e.date) >= since.getTime()),
});

const real = () => {
  const { html, meta } = fixture('swiggy-delivered-1');
  return { ...meta, html } as RawEmail;
};

const SINCE = '2026-10-01T00:00:00Z';

/** A model that answers kcal prompts with 100 per dish and bill-extraction prompts with `bill`. */
function fakeLlm(bill?: unknown): LlmClient & { complete: ReturnType<typeof vi.fn> } {
  return {
    model: 'fake',
    complete: vi.fn(async (system: string, user: string) => {
      if (system.includes('food energy')) {
        const n = user.split('\n').length - 1;
        return JSON.stringify({ items: Array.from({ length: n }, () => ({ kcal: 100 })) });
      }
      if (bill === undefined) throw new Error('no bill configured');
      return '```json\n' + JSON.stringify(bill) + '\n```';
    }),
  };
}

describe('estimateKcal', () => {
  it('normalizes names and caches per dish', async () => {
    const store = createMemoryStore();
    const llm = fakeLlm();
    await estimateKcal(['Paneer Momos', 'paneer  momos!'], { store, llm });
    expect(llm.complete).toHaveBeenCalledTimes(1);
    await estimateKcal(['PANEER MOMOS'], { store, llm });
    expect(llm.complete).toHaveBeenCalledTimes(1); // second call served from cache
    expect(normalizeName('  Paneer-Momos (6 pcs) ')).toBe('paneer momos 6 pcs');
  });

  it('rejects implausible model output instead of storing it', async () => {
    const llm: LlmClient = { model: 'bad', complete: async () => '{"items":[{"kcal":999999}]}' };
    await expect(estimateKcal(['x'], { store: createMemoryStore(), llm })).rejects.toThrow(/implausible/);
  });

  it('rejects a reply with the wrong number of items', async () => {
    const llm: LlmClient = { model: 'bad', complete: async () => '{"items":[]}' };
    await expect(estimateKcal(['x'], { store: createMemoryStore(), llm })).rejects.toThrow();
  });

  it('uses the offline table when there is no LLM', async () => {
    const m = await estimateKcal(['Chicken Biryani'], { store: createMemoryStore(), llm: null });
    expect(m.get('chicken biryani')).toMatchObject({ kcalPerUnit: mockKcal('chicken biryani'), source: 'mock' });
  });
});

describe('syncOnce', () => {
  it('ingests the real fixture end to end', async () => {
    const store = createMemoryStore({ trackingSince: SINCE });
    const r = await syncOnce({ store, source: sourceOf([real()]), llm: null });
    expect(r).toMatchObject({ fetched: 1, inserted: 1, failed: 0 });
    const [order] = await store.listOrders();
    expect(order).toMatchObject({ orderId: '251027100172577', total: 232, messageId: 'fixture-1' });
    expect(order.kcalTotal).toBe(350); // mock: momos
    expect(order.items[0].kcalSource).toBe('mock');
  });

  it('is idempotent: re-syncing does not double count', async () => {
    const store = createMemoryStore({ trackingSince: SINCE });
    const source = sourceOf([real()]);
    await syncOnce({ store, source, llm: null });
    const second = await syncOnce({ store, source, llm: null });
    expect(second.inserted).toBe(0);
    expect(await store.listOrders()).toHaveLength(1);
  });

  it('ignores emails from before trackingSince', async () => {
    const store = createMemoryStore({ trackingSince: '2026-10-16T00:00:00Z' });
    const r = await syncOnce({ store, source: sourceOf([real()]), llm: null });
    expect(r.fetched).toBe(0);
    expect(await store.listOrders()).toHaveLength(0);
  });

  it('skips non-bill emails without retrying them', async () => {
    const store = createMemoryStore({ trackingSince: SINCE });
    const junk: RawEmail = { ...real(), messageId: 'junk', html: '<html>promo</html>' };
    const r = await syncOnce({ store, source: sourceOf([junk]), llm: null });
    expect(r.skipped).toBe(1);
    expect((await store.getProcessedEmails()).has('junk')).toBe(true);
  });

  const groupedEmail = (): RawEmail => ({
    ...real(),
    messageId: 'grouped',
    html: billHtml({
      grouped: true,
      orderId: '777',
      items: [['Burger x1', '₹200']],
      charges: [['Taxes', '₹10']],
      total: ['Paid Via UPI', '₹210'],
    }),
  });

  it('uses the LLM fallback for unrecognised layouts and validates the sum', async () => {
    const store = createMemoryStore({ trackingSince: SINCE });
    const llm = fakeLlm({
      items: [{ name: 'Burger', qty: 1, price: 200 }],
      charges: [{ label: 'Taxes', amount: 10 }],
      total: 210,
      paymentMethod: 'UPI',
    });
    const r = await syncOnce({ store, source: sourceOf([groupedEmail()]), llm });
    expect(r.inserted).toBe(1);
    const [order] = await store.listOrders();
    expect(order).toMatchObject({ orderId: '777', parsedBy: 'llm', total: 210 });
    // Only the bill table text may be sent to the model for extraction.
    const extractionCall = llm.complete.mock.calls.find(([sys]) => String(sys).includes('BILL DETAILS'))!;
    expect(extractionCall[1]).not.toMatch(/Someone|Some Address/);
  });

  it('rejects an LLM bill that does not add up', async () => {
    const store = createMemoryStore({ trackingSince: SINCE });
    const llm = fakeLlm({ items: [{ name: 'Burger', qty: 1, price: 200 }], charges: [], total: 999 });
    const r = await syncOnce({ store, source: sourceOf([groupedEmail()]), llm });
    expect(r).toMatchObject({ inserted: 0, failed: 1 });
    expect(await store.listOrders()).toHaveLength(0);
  });

  it('keeps the order when calorie estimation fails and retries on the next sync', async () => {
    const store = createMemoryStore({ trackingSince: SINCE });
    let healthy = false;
    const llm: LlmClient = {
      model: 'flaky',
      complete: async () => {
        if (!healthy) throw new Error('503');
        return '{"items":[{"kcal":400}]}';
      },
    };
    const source = sourceOf([real()]);
    await syncOnce({ store, source, llm });
    expect((await store.listOrders())[0].kcalTotal).toBeUndefined();

    healthy = true;
    const r = await syncOnce({ store, source, llm });
    expect(r.kcalRetried).toBe(1);
    expect((await store.listOrders())[0].kcalTotal).toBe(400);
  });
});

describe('createSyncRunner', () => {
  it('shares one in-flight sync between concurrent callers and records the error', async () => {
    const store = createMemoryStore();
    let calls = 0;
    const source: EmailSource = {
      mode: 'mock',
      isConnected: async () => true,
      fetchSwiggyEmails: async () => {
        calls++;
        await new Promise((r) => setTimeout(r, 20));
        throw new Error('gmail down');
      },
    };
    const run = createSyncRunner({ store, source, llm: null });
    const results = await Promise.allSettled([run(), run()]);
    expect(calls).toBe(1);
    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    expect((await store.getSyncState()).lastError).toBe('gmail down');
  });
});
