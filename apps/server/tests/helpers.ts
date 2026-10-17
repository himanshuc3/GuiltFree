import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const FIXTURES = resolve(import.meta.dirname, '../../../fixtures/emails');

export function fixture(name: string): { html: string; meta: { messageId: string; date: string; subject: string; from: string } } {
  return {
    html: readFileSync(resolve(FIXTURES, `${name}.html`), 'utf8'),
    meta: JSON.parse(readFileSync(resolve(FIXTURES, `${name}.json`), 'utf8')),
  };
}

interface BillOpts {
  restaurant?: string;
  orderId?: string;
  items: [string, string][]; // [label, amount text]
  charges?: [string, string][];
  total?: [string, string];
  /** Insert a single-cell group header row, like the multi-restaurant layout. */
  grouped?: boolean;
}

const sep = '<tr><td colspan="3"><div style="border-bottom:0.8px dashed #ccc;"></div></td></tr>';
const row = ([label, amount]: [string, string]) =>
  `<tr><td>${label}</td><td></td><td align="right"><span>${amount}</span></td></tr>`;

/** Minimal HTML with the same structure as Swiggy's delivered email. */
export function billHtml(o: BillOpts): string {
  const charges = o.charges ?? [];
  const total = o.total ?? (['Paid Via UPI', '₹0'] as [string, string]);
  return `<html><body>
  <div>₹40 saved on this order</div>
  <div>
    <p>ORDER JOURNEY</p>
    <div><p>${o.restaurant ?? 'Test Kitchen'}</p><p>1 Market Road</p><p>Oct 15, 3:15 PM</p></div>
    <div><p>Someone</p><p>Some Address</p><p>Oct 15, 4:14 PM</p></div>
    <div>Order ID: <span>${o.orderId ?? '999'}</span></div>
  </div>
  <table><tr><td colspan="3"><div>BILL DETAILS</div></td></tr>
  <tbody>
    ${o.grouped ? '<tr><td colspan="3"><b>From Test Kitchen</b></td></tr>' : ''}
    ${o.items.map(row).join('\n')}
    ${sep}
    ${charges.map(row).join('\n')}
    ${charges.length ? sep : ''}
    ${row(total)}
  </tbody></table></body></html>`;
}
