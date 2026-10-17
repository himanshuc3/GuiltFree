import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createMockSource } from '../src/gmail/mock';
import { createMemoryStore } from '../src/store/memory';
import { createSyncRunner } from '../src/sync';
import { FIXTURES } from './helpers';

let server: ReturnType<ReturnType<typeof createApp>['listen']>;
let base: string;

// "Now" is the Thursday the real email was delivered, so un-rebased fixtures fall in this week.
const NOW = new Date('2026-10-16T06:00:00Z');

beforeEach(async () => {
  const store = createMemoryStore({ trackingSince: '2026-10-01T00:00:00Z' });
  const source = createMockSource({ dir: FIXTURES, rebaseDates: false });
  const runSync = createSyncRunner({ store, source, llm: null });
  const app = createApp({ config: { APP_API_KEY: 'test-key' }, store, source, llm: null, runSync, now: () => NOW });
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(() => new Promise<void>((r) => server.close(() => r())));

const call = (path: string, init: RequestInit = {}, key: string | null = 'test-key') =>
  fetch(base + path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(key ? { 'x-api-key': key } : {}), ...init.headers },
  });

describe('API', () => {
  it('serves /health without a key', async () => {
    expect((await call('/health', {}, null)).status).toBe(200);
  });

  it('rejects missing or wrong api keys', async () => {
    expect((await call('/status', {}, null)).status).toBe(401);
    expect((await call('/status', {}, 'nope')).status).toBe(401);
  });

  it('reports Gmail OAuth as unavailable in mock mode', async () => {
    expect((await call('/auth/google/start', { redirect: 'manual' }, null)).status).toBe(404);
  });

  it('syncs fixtures, then reports status against limits', async () => {
    const sync = await call('/sync', { method: 'POST' });
    expect(sync.status).toBe(200);
    expect((await sync.json()).result).toMatchObject({ fetched: 4, inserted: 4, failed: 0 });

    const put = await call('/settings', { method: 'PUT', body: JSON.stringify({ limits: { weekly: { orders: 10 } } }) });
    expect(put.status).toBe(200);

    const body = await (await call('/status')).json();
    // all four fixtures are dated Oct 12-15, inside the week that starts Mon 12 Oct 00:00 IST
    expect(body.status.week.orderCount).toBe(4);
    expect(body.status.week.metrics[0]).toMatchObject({ metric: 'orders', used: 4, limit: 10, level: 'ok' });
    expect(body.status.limitReached).toBe(false);
    expect(body.gmail).toEqual({ mode: 'mock', connected: true });
    expect(body.llm.mode).toBe('mock');
    expect(body.sync.lastError).toBeNull();
  });

  it('flags the limit once it is hit', async () => {
    await call('/sync', { method: 'POST' });
    await call('/settings', { method: 'PUT', body: JSON.stringify({ limits: { weekly: { orders: 4 } } }) });
    const body = await (await call('/status')).json();
    expect(body.status.limitReached).toBe(true);
    expect(body.status.reasons[0]).toMatch(/Weekly orders limit reached/);
  });

  it('lists orders newest first', async () => {
    await call('/sync', { method: 'POST' });
    const { orders } = await (await call('/orders?limit=2')).json();
    expect(orders).toHaveLength(2);
    expect(orders[0].deliveredAt >= orders[1].deliveredAt).toBe(true);
  });

  it('validates limits', async () => {
    const res = await call('/settings', { method: 'PUT', body: JSON.stringify({ limits: { weekly: { orders: -1 } } }) });
    expect(res.status).toBe(400);
  });

  it('replaces a period wholesale so a limit can be cleared', async () => {
    await call('/settings', { method: 'PUT', body: JSON.stringify({ limits: { weekly: { orders: 3, spend: 500 } } }) });
    await call('/settings', { method: 'PUT', body: JSON.stringify({ limits: { weekly: { orders: 3 } } }) });
    const s = await (await call('/settings')).json();
    expect(s.limits.weekly).toEqual({ orders: 3 });
  });
});
