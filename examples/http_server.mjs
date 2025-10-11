import { startServer } from '../dist/http/server.js';
import fs from 'node:fs/promises';

const policy = JSON.parse(await fs.readFile(new URL('./policy.sample.json', import.meta.url)));
await startServer({ policy, policyHash: '0x' + 'ff'.repeat(32), port: 8787 });
console.log('Policy HTTP server listening on http://127.0.0.1:8787');
