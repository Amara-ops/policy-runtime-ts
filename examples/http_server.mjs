import { startServer } from '../dist/http/server.js';
import fs from 'node:fs/promises';
import { computePolicyHash } from '../dist/util/policyHash.js';

const policy = JSON.parse(await fs.readFile(new URL('./policy.v0_3.sample.json', import.meta.url)));
await startServer({ policy, policyHash: computePolicyHash(policy), port: 8787 });
console.log('Policy HTTP server listening on http://127.0.0.1:8787');
