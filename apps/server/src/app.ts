import { timingSafeEqual } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { LimitsUpdateSchema, computeStatus } from '@guiltfree/shared';
import type { Config } from './config';
import type { GoogleAuth } from './gmail/google';
import type { EmailSource } from './gmail/types';
import type { LlmClient } from './llm/client';
import type { Store } from './store/types';
import type { SyncResult } from './sync';

export interface AppDeps {
  config: Pick<Config, 'APP_API_KEY'>;
  store: Store;
  source: EmailSource;
  llm: LlmClient | null;
  runSync: () => Promise<SyncResult>;
  googleAuth?: GoogleAuth;
  now?: () => Date;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function createApp(deps: AppDeps) {
  const { store, source, llm, runSync, googleAuth } = deps;
  const now = deps.now ?? (() => new Date());
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => void res.json({ ok: true }));

  // Gmail OAuth is opened in a browser on the machine running the server, so it sits outside the API key.
  app.get('/auth/google/start', (_req, res) => {
    if (!googleAuth) return void res.status(404).send('Gmail OAuth is not enabled (GMAIL_MODE=mock).');
    res.redirect(googleAuth.authUrl());
  });
  app.get('/auth/google/callback', async (req, res) => {
    if (!googleAuth) return void res.status(404).send('Gmail OAuth is not enabled.');
    const { code, state, error } = req.query;
    if (error || typeof code !== 'string' || typeof state !== 'string') {
      return void res.status(400).send(`Gmail connection failed: ${String(error ?? 'missing code')}`);
    }
    try {
      await googleAuth.handleCallback(code, state);
      res.send('Gmail connected. You can close this tab and pull to refresh in the app.');
    } catch (err) {
      res.status(400).send(`Gmail connection failed: ${(err as Error).message}`);
    }
  });

  const requireKey = (req: Request, res: Response, next: NextFunction) => {
    const key = req.header('x-api-key');
    if (!key || !safeEqual(key, deps.config.APP_API_KEY)) return void res.status(401).json({ error: 'unauthorized' });
    next();
  };
  app.use(requireKey);

  app.get('/status', async (_req, res) => {
    const [settings, orders, syncState, connected] = await Promise.all([
      store.getSettings(),
      store.listOrders(),
      store.getSyncState(),
      source.isConnected(),
    ]);
    res.json({
      now: now().toISOString(),
      settings,
      status: computeStatus(orders, settings, now()),
      gmail: { mode: source.mode, connected },
      llm: { mode: llm ? 'live' : 'mock', model: llm?.model ?? null },
      sync: syncState,
    });
  });

  app.get('/orders', async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    res.json({ orders: await store.listOrders({ limit }) });
  });

  app.get('/settings', async (_req, res) => void res.json(await store.getSettings()));

  app.put('/settings', async (req, res) => {
    const parsed = LimitsUpdateSchema.safeParse(req.body?.limits ?? req.body);
    if (!parsed.success) return void res.status(400).json({ error: 'invalid limits', details: parsed.error.issues });
    res.json(await store.updateLimits(parsed.data));
  });

  app.post('/sync', async (_req, res) => {
    try {
      res.json({ result: await runSync() });
    } catch (err) {
      res.status(502).json({ error: (err as Error).message });
    }
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  });

  return app;
}
