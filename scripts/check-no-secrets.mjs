#!/usr/bin/env node
/**
 * Fails the build if any forbidden secret pattern appears in the app source or
 * an exported bundle. A client bundle must contain ONLY the public Supabase
 * anon key — never a service-role key, Stripe secret, Claude key, or private
 * key. See the platform CLAUDE.md §8.
 *
 * Usage: node scripts/check-no-secrets.mjs [dir ...]
 * Defaults to scanning ./src and ./app.json, plus ./dist when it exists
 * (i.e. after `expo export`), so CI verifies the real bundle.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const FORBIDDEN = [
  { name: 'Supabase service-role reference', re: /service_role/ },
  { name: 'Supabase service-role env name', re: /SUPABASE_SERVICE_ROLE_KEY/ },
  { name: 'Stripe secret key', re: /sk_(live|test)_[A-Za-z0-9]/ },
  { name: 'Stripe webhook secret', re: /whsec_[A-Za-z0-9]/ },
  { name: 'Anthropic API key', re: /sk-ant-[A-Za-z0-9]/ },
  { name: 'Private key block', re: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/ },
];

// Skip this script itself (it necessarily contains the patterns above).
const SKIP_DIRS = new Set(['node_modules', '.git', '.expo', 'scripts', 'ios', 'android']);
const SCAN_EXT = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.html', '.txt', '.map',
]);

const roots = process.argv.slice(2);
const targets = roots.length > 0 ? roots : ['src', 'app.json'];
if (roots.length === 0 && existsSync('dist')) targets.push('dist');

let violations = 0;

function scanFile(path) {
  let content;
  try {
    content = readFileSync(path, 'utf8');
  } catch {
    return;
  }
  for (const { name, re } of FORBIDDEN) {
    if (re.test(content)) {
      console.error(`✖ ${name} found in ${path}`);
      violations += 1;
    }
  }
}

function walk(path) {
  const st = statSync(path);
  if (st.isDirectory()) {
    for (const entry of readdirSync(path)) {
      if (SKIP_DIRS.has(entry)) continue;
      walk(join(path, entry));
    }
  } else if (SCAN_EXT.has(extname(path))) {
    scanFile(path);
  }
}

for (const t of targets) {
  if (existsSync(t)) walk(t);
}

if (violations > 0) {
  console.error(`\n${violations} secret pattern(s) detected. Failing.`);
  process.exit(1);
}
console.log('✓ No forbidden secret patterns found.');
