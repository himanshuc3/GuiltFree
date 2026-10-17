// Fails if tracked or staged files look like they contain real credentials.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PATTERNS = [
  [/sk-or-v1-[A-Za-z0-9]{20,}/, 'OpenRouter key'],
  [/GOCSPX-[A-Za-z0-9_-]{10,}/, 'Google OAuth client secret'],
  [/mongodb(\+srv)?:\/\/[^\s:@/]+:[^\s@/]+@/, 'MongoDB URI with credentials'],
  [/AIza[0-9A-Za-z_-]{35}/, 'Google API key'],
  [/-----BEGIN (RSA |EC )?PRIVATE KEY-----/, 'private key'],
  [/ya29\.[0-9A-Za-z_-]{20,}/, 'Google access token'],
  [/1\/\/[0-9A-Za-z_-]{40,}/, 'Google refresh token'],
];

const files = execSync('git ls-files --cached --others --exclude-standard', { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);

let bad = 0;
for (const f of files) {
  let text;
  try {
    text = readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  for (const [re, name] of PATTERNS) {
    if (re.test(text)) {
      console.error(`possible ${name} in ${f}`);
      bad++;
    }
  }
}
if (bad) process.exit(1);
console.log(`secret scan ok (${files.length} files)`);
