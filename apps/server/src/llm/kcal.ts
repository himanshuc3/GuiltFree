import { z } from 'zod';
import type { Order, OrderItem } from '@guiltfree/shared';
import { extractJson, type LlmClient } from './client';
import type { Store } from '../store/types';

export interface KcalEntry {
  kcalPerUnit: number;
  source: 'llm' | 'mock';
}

const MAX_KCAL_PER_UNIT = 3000;

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MOCK_TABLE: [RegExp, number][] = [
  [/biryani/, 650],
  [/pizza/, 700],
  [/burger/, 500],
  [/momo/, 350],
  [/paneer/, 450],
  [/chicken/, 480],
  [/dosa/, 300],
  [/roll|wrap/, 400],
  [/fries/, 365],
  [/coke|cola|pepsi|soda|sprite/, 150],
  [/shake|ice ?cream|brownie|cake|gulab/, 400],
  [/bread/, 250],
  [/raita/, 90],
];

/** Offline stand-in used when no LLM key is configured. Not an estimate of anything real. */
export function mockKcal(name: string): number {
  const n = normalizeName(name);
  return MOCK_TABLE.find(([re]) => re.test(n))?.[1] ?? 450;
}

const SYSTEM = `You estimate food energy for Indian food-delivery orders.
For each dish name, give the typical kilocalories of ONE unit as it is usually served by a restaurant (one plate, one burger, one bottle...).
Reply with JSON only, no prose: {"items":[{"kcal":<number>}, ...]} with exactly one entry per input dish, in the same order.`;

const ReplySchema = z.object({ items: z.array(z.object({ kcal: z.number() })) });

async function askLlm(llm: LlmClient, names: string[]): Promise<number[]> {
  const prompt = `Dishes:\n${names.map((n, i) => `${i + 1}. ${n}`).join('\n')}`;
  const reply = ReplySchema.parse(extractJson(await llm.complete(SYSTEM, prompt)));
  if (reply.items.length !== names.length) throw new Error('model returned wrong number of items');
  return reply.items.map((i) => {
    if (!(i.kcal > 0 && i.kcal <= MAX_KCAL_PER_UNIT)) throw new Error(`implausible kcal: ${i.kcal}`);
    return Math.round(i.kcal);
  });
}

/**
 * Per-unit calories for each distinct dish, using the cache first. Only dish names ever leave the
 * server, never email text. Throws if the model fails; callers keep the order and retry later.
 */
export async function estimateKcal(
  names: string[],
  deps: { store: Store; llm: LlmClient | null },
): Promise<Map<string, KcalEntry & { cached: boolean }>> {
  const unique = [...new Set(names.map(normalizeName))];
  const cached = await deps.store.getKcal(unique);
  const out = new Map<string, KcalEntry & { cached: boolean }>();
  for (const [k, v] of Object.entries(cached)) out.set(k, { ...v, cached: true });

  const missing = unique.filter((n) => !out.has(n));
  if (missing.length) {
    const fresh: Record<string, KcalEntry> = {};
    if (deps.llm) {
      const values = await askLlm(deps.llm, missing);
      missing.forEach((n, i) => (fresh[n] = { kcalPerUnit: values[i], source: 'llm' }));
    } else {
      for (const n of missing) fresh[n] = { kcalPerUnit: mockKcal(n), source: 'mock' };
    }
    await deps.store.setKcal(fresh);
    for (const [k, v] of Object.entries(fresh)) out.set(k, { ...v, cached: false });
  }
  return out;
}

/** Attaches calorie estimates to an order's items and totals them. */
export async function withKcal(order: Order, deps: { store: Store; llm: LlmClient | null }): Promise<Order> {
  const estimates = await estimateKcal(order.items.map((i) => i.name), deps);
  const items: OrderItem[] = order.items.map((item) => {
    const e = estimates.get(normalizeName(item.name))!;
    return { ...item, kcalPerUnit: e.kcalPerUnit, kcalSource: e.cached ? 'cache' : e.source };
  });
  const kcalTotal = items.reduce((s, i) => s + (i.kcalPerUnit ?? 0) * i.qty, 0);
  return { ...order, items, kcalTotal };
}
