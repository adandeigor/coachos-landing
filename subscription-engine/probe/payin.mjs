// usage: node probe/payin.mjs <RESEAU> <numero> [montant=100] [otp]
import { loadEnv, call } from './lib.mjs';
const [network, phone, amount = '100', otp] = process.argv.slice(2);
if (!network || !phone) { console.error('usage: payin.mjs <reseau> <numero> [montant] [otp]'); process.exit(1); }
const env = loadEnv();
const callback_info = `probe_${Date.now()}`;
const body = { phoneNumber: phone, amount: Number(amount), shop: env.FEEXPAY_SHOP,
  description: 'Sondage sandbox', callback_info, ...(otp ? { otp } : {}) };
console.log(JSON.stringify(await call(env, 'POST', `/api/transactions/public/requesttopay/${network}`, body), null, 2));
