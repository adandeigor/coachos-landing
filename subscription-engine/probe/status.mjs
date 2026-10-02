import { loadEnv, call } from './lib.mjs';
const ref = process.argv[2] ?? '00000000-0000-0000-0000-000000000000';
console.log(JSON.stringify(await call(loadEnv(), 'GET', `/api/transactions/public/single/status/${ref}`), null, 2));
