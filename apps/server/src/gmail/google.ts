import { randomBytes } from 'node:crypto';
import { gmail as gmailApi } from '@googleapis/gmail';
import { OAuth2Client } from 'google-auth-library';
import { simpleParser } from 'mailparser';
import type { Config } from '../config';
import type { Store } from '../store/types';
import type { EmailSource, RawEmail } from './types';

const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const SENDER = 'noreply@swiggy.in';
const SUBJECT = 'successfully delivered';
const MAX_MESSAGES = 200;

export interface GoogleAuth {
  authUrl(): string;
  /** Throws if `state` was not issued by authUrl(). */
  handleCallback(code: string, state: string): Promise<void>;
}

export function createGoogleAuth(config: Config, store: Store): { auth: GoogleAuth; source: EmailSource } {
  const client = new OAuth2Client(config.GOOGLE_CLIENT_ID, config.GOOGLE_CLIENT_SECRET, config.GOOGLE_REDIRECT_URI);
  const pendingStates = new Set<string>();

  // Google only returns a refresh token on consent and may rotate access tokens; keep both.
  client.on('tokens', async (t) => {
    const current = (await store.getGoogleToken()) ?? {};
    await store.setGoogleToken({ ...current, ...t });
  });

  const auth: GoogleAuth = {
    authUrl() {
      const state = randomBytes(16).toString('hex');
      pendingStates.add(state);
      return client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: [SCOPE],
        state,
      });
    },
    async handleCallback(code, state) {
      if (!pendingStates.delete(state)) throw new Error('unknown OAuth state');
      const { tokens } = await client.getToken(code);
      await store.setGoogleToken(tokens);
    },
  };

  const source: EmailSource = {
    mode: 'google',
    async isConnected() {
      return Boolean((await store.getGoogleToken())?.refresh_token);
    },
    async fetchSwiggyEmails(since) {
      const token = await store.getGoogleToken();
      if (!token?.refresh_token) throw new Error('Gmail is not connected. Open /auth/google/start in a browser.');
      client.setCredentials(token);
      const gmail = gmailApi({ version: 'v1', auth: client });

      const q = `from:${SENDER} subject:"${SUBJECT}" after:${Math.floor(since.getTime() / 1000)}`;
      const ids: string[] = [];
      let pageToken: string | undefined;
      do {
        const res = await gmail.users.messages.list({ userId: 'me', q, pageToken, maxResults: 50 });
        ids.push(...(res.data.messages ?? []).map((m) => m.id!).filter(Boolean));
        pageToken = res.data.nextPageToken ?? undefined;
      } while (pageToken && ids.length < MAX_MESSAGES);

      const emails: RawEmail[] = [];
      for (const id of ids) {
        const msg = await gmail.users.messages.get({ userId: 'me', id, format: 'raw' });
        if (!msg.data.raw) continue;
        const mail = await simpleParser(Buffer.from(msg.data.raw, 'base64url'));
        if (!mail.html) continue;
        emails.push({
          messageId: id,
          date: (mail.date ?? new Date(Number(msg.data.internalDate))).toISOString(),
          subject: mail.subject ?? '',
          from: mail.from?.text ?? '',
          html: mail.html,
        });
      }
      return emails;
    },
  };

  return { auth, source };
}
