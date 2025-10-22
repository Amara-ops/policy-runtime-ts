import { readFileSync } from 'node:fs';
import { startServer } from '../dist/http/server.js';

const policyPath = process.env.POLICY_PATH || new URL('./policy.v0_3.sample.json', import.meta.url).pathname;

const policyRaw = JSON.parse(readFileSync(policyPath, 'utf8'));

startServer({ port: 8787, host: '127.0.0.1', policy: policyRaw }).then(({ server }) => {
  console.log('Policy Runtime listening on http://127.0.0.1:8787');
  console.log('Policy file:', policyPath);
  console.log('Press Ctrl+C to stop.');
}).catch((e) => { console.error(e); process.exit(1); });
