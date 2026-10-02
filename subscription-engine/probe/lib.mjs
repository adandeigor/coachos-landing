// Sondage FeexPay sandbox - aucune dépendance. Refuse toute clé qui ressemble à du Live.
import { readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function loadEnv() {
  const env = {};
  for (const line of readFileSync(join(root, '.env.sandbox'), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  if (env.PAYMENT_ENV !== 'sandbox') throw new Error('PAYMENT_ENV doit valoir sandbox');
  // Garde-fou provisoire de la phase 1 : la clé de test observée commence par "test_".
  if (!env.FEEXPAY_API_KEY?.startsWith('test_')) {
    throw new Error('Clé refusée : le sondage n\'accepte que la clé de Test (préfixe test_).');
  }
  return env;
}

export async function call(env, method, path, body) {
  const t0 = Date.now();
  const res = await fetch(env.FEEXPAY_BASE_URL + path, {
    method,
    headers: { Authorization: `Bearer ${env.FEEXPAY_API_KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = null; }
  const out = { method, path, httpStatus: res.status, ms: Date.now() - t0,
    headers: Object.fromEntries(res.headers), body: json ?? text };
  mkdirSync(join(root, 'probe/logs'), { recursive: true });
  appendFileSync(join(root, 'probe/logs/calls.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...out }) + '\n');
  return out;
}
