import { readFileSync } from 'node:fs';
import { startServer } from '../dist/http/server.js';

const policyPath = process.env.POLICY_PATH || new URL('./policy.sample.json', import.meta.url).pathname;
const AUTH_TOKEN = process.env.AUTH_TOKEN;

const policyRaw = JSON.parse(readFileSync(policyPath, 'utf8'));

startServer({ port: 8787, host: '127.0.0.1', authToken: AUTH_TOKEN, policy: policyRaw }).then((res) => {
  if (res?.alreadyRunning) {
    console.log('Policy Runtime already running at http://127.0.0.1:8787');
    return;
  }
  console.log('Policy Runtime listening on http://127.0.0.1:8787');
  console.log('Policy file:', policyPath);
  if (AUTH_TOKEN) console.log('Auth: Bearer token required'); else console.log('Auth: DISABLED (dev only)');
  console.log('Press Ctrl+C to stop.');
}).catch((e) => { console.error(e); process.exit(1); });
