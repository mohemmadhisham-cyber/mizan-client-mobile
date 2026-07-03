#!/usr/bin/env node
/**
 * Fails the build if the EN and AR translation files have diverged in a way
 * that would cause a real gap (a key EN has that AR lacks, or vice versa).
 * Arabic's CLDR plural system needs _zero/_two/_few/_many suffixes that
 * English's simpler _one/_other system doesn't — those are expected and are
 * not counted as gaps here.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const i18nDir = join(__dirname, '..', 'src', 'i18n');

const PLURAL_SUFFIXES = ['_zero', '_one', '_two', '_few', '_many', '_other'];

function baseKey(key) {
  const suffix = PLURAL_SUFFIXES.find((s) => key.endsWith(s));
  return suffix ? key.slice(0, -suffix.length) : key;
}

function flatten(obj, prefix = '') {
  let keys = [];
  for (const k of Object.keys(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (obj[k] && typeof obj[k] === 'object') keys = keys.concat(flatten(obj[k], full));
    else keys.push(full);
  }
  return keys;
}

const en = JSON.parse(readFileSync(join(i18nDir, 'en.json'), 'utf8'));
const ar = JSON.parse(readFileSync(join(i18nDir, 'ar.json'), 'utf8'));

const enKeys = new Set(flatten(en).map(baseKey));
const arKeys = new Set(flatten(ar).map(baseKey));

const missingInAr = [...enKeys].filter((k) => !arKeys.has(k));
const missingInEn = [...arKeys].filter((k) => !enKeys.has(k));

if (missingInAr.length > 0 || missingInEn.length > 0) {
  if (missingInAr.length > 0) console.error('Keys in en.json missing from ar.json:', missingInAr);
  if (missingInEn.length > 0) console.error('Keys in ar.json missing from en.json:', missingInEn);
  process.exit(1);
}

console.log('✓ EN/AR translation keys are in parity.');
