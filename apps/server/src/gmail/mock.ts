import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { EmailSource, RawEmail } from './types';

const DEFAULT_DIR = resolve(import.meta.dirname, '../../../../fixtures/emails');
const HOUR = 3600 * 1000;

/**
 * Serves the redacted fixtures as if they were in a mailbox. With `rebaseDates`, each email is
 * re-dated to a few hours/days ago so a demo always lands in the current week.
 */
export function createMockSource(opts: { dir?: string; rebaseDates: boolean }): EmailSource {
  const dir = opts.dir ?? DEFAULT_DIR;

  const load = (): RawEmail[] =>
    readdirSync(dir)
      .filter((f) => f.endsWith('.html'))
      .sort()
      .map((f, i) => {
        const meta = JSON.parse(readFileSync(resolve(dir, f.replace(/\.html$/, '.json')), 'utf8'));
        const date = opts.rebaseDates ? new Date(Date.now() - (2 + i * 20) * HOUR).toISOString() : meta.date;
        return {
          messageId: meta.messageId,
          date,
          subject: meta.subject,
          from: meta.from,
          html: readFileSync(resolve(dir, f), 'utf8'),
        };
      });

  return {
    mode: 'mock',
    async isConnected() {
      return true;
    },
    async fetchSwiggyEmails(since) {
      return load().filter((e) => Date.parse(e.date) >= since.getTime());
    },
  };
}
