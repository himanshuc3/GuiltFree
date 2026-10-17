export interface RawEmail {
  messageId: string;
  /** ISO timestamp from the Date header. */
  date: string;
  subject: string;
  from: string;
  html: string;
}

export interface EmailSource {
  readonly mode: 'mock' | 'google';
  isConnected(): Promise<boolean>;
  /** Swiggy "delivered" emails received at or after `since`. */
  fetchSwiggyEmails(since: Date): Promise<RawEmail[]>;
}
