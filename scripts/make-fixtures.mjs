// Builds fixtures/emails/* from a raw Swiggy "delivered" .eml.
//   node scripts/make-fixtures.mjs path/to/email.eml
// The customer name and address are replaced with placeholders. Never commit the raw .eml.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'apps/server/package.json'));
const { simpleParser } = require('mailparser');
const cheerio = require('cheerio');

const emlPath = process.argv[2];
if (!emlPath) {
  console.error('usage: node scripts/make-fixtures.mjs <path-to.eml>');
  process.exit(1);
}

const mail = await simpleParser(readFileSync(emlPath));
if (!mail.html) throw new Error('no HTML part in email');

const TIME_RE = /^[A-Za-z]{3} \d{1,2}, \d{1,2}:\d{2} ?[AP]M$/i;
const outDir = resolve(root, 'fixtures/emails');
mkdirSync(outDir, { recursive: true });

function redact($) {
  const anchors = $('p').filter((_, el) => TIME_RE.test($(el).text().trim()));
  const customer = $(anchors.get(anchors.length - 1)).parent().children('p');
  customer.eq(0).text('Test User');
  customer.eq(1).text('12 Example Street, Sample Nagar, New Delhi, Delhi 110001, India');
}

function write(name, $, meta) {
  writeFileSync(resolve(outDir, `${name}.html`), $.html());
  writeFileSync(resolve(outDir, `${name}.json`), JSON.stringify(meta, null, 2) + '\n');
  console.log('wrote', name);
}

const meta = {
  messageId: 'fixture-1',
  date: mail.date.toISOString(),
  subject: mail.subject,
  from: mail.from.text,
  synthetic: false,
};

const $real = cheerio.load(mail.html);
redact($real);
write('swiggy-delivered-1', $real, meta);

// Synthetic variants derived from the real layout, for multi-item demos and tests.
const variants = [
  {
    restaurant: 'Biryani Junction',
    orderId: '251027100180001',
    items: [['Chicken Biryani', 2, 520], ['Raita', 1, 40]],
    hoursAgo: 30,
  },
  {
    restaurant: 'Slice of Italy',
    orderId: '251027100180002',
    items: [['Margherita Pizza', 1, 399], ['Garlic Bread', 1, 149], ['Coke', 2, 80]],
    hoursAgo: 55,
  },
  {
    restaurant: 'Dosa Corner',
    orderId: '251027100180003',
    items: [['Masala Dosa', 2, 240]],
    hoursAgo: 80,
  },
];

variants.forEach((v, i) => {
  const $ = cheerio.load($real.html());
  const times = $('p').filter((_, el) => TIME_RE.test($(el).text().trim()));
  $(times.get(0)).parent().children('p').eq(0).text(v.restaurant);
  $('span').filter((_, el) => /^\d{12,}$/.test($(el).text().trim())).text(v.orderId);

  const table = $('div').filter((_, el) => $(el).text().trim() === 'BILL DETAILS').first().closest('table');
  const rows = table.children('tbody').children('tr').toArray();
  const itemRows = [];
  for (const tr of rows) {
    const cells = $(tr).children('td');
    if (cells.length === 3) itemRows.push(tr);
    else if (itemRows.length) break;
  }
  const template = $(itemRows[0]);
  let itemsTotal = 0;
  v.items.forEach(([name, qty, price]) => {
    const row = template.clone();
    row.children('td').eq(0).text(`${name} x${qty}`);
    row.children('td').eq(2).find('span').text(`₹${price}`);
    template.before(row);
    itemsTotal += price;
  });
  template.remove();

  const tax = Math.round(itemsTotal * 0.05 * 100) / 100;
  const total = itemsTotal + 10 + 17.98 + tax;
  table.find('tr').each((_, tr) => {
    const label = $(tr).children('td').eq(0).text().trim();
    const amount = $(tr).children('td').eq(2).find('span').first();
    if (label === 'Taxes') amount.text(`₹${tax}`);
    if (label.startsWith('Paid Via')) amount.text(`₹${Math.round(total)}`);
  });

  const date = new Date(mail.date.getTime() - v.hoursAgo * 3600 * 1000);
  write(`swiggy-delivered-${i + 2}`, $, {
    ...meta,
    messageId: `fixture-${i + 2}`,
    date: date.toISOString(),
    synthetic: true,
  });
});
