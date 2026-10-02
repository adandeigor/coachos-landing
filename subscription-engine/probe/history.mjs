import { loadEnv, call } from './lib.mjs';
const env = loadEnv();
const d = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
console.log(JSON.stringify(await call(env, 'POST', '/api/transactions/history',
  { start_date: d(7), end_date: d(0), shop: env.FEEXPAY_SHOP, type: 'ALL', status: 'ALL', reseau: 'ALL' }), null, 2));
