import http from 'node:http';
import { PolicyEngine, FileCounterStore, JsonlFileLogger } from '../index.js';
import { computePolicyHash } from '../util/policyHash.js';

export async function startServer(opts?: { port?: number; policy: any; policyHash?: string }) {
  const port = opts?.port ?? 8787;
  const policy = opts?.policy;
  const policyHash = opts?.policyHash ?? computePolicyHash(policy);
  if (!policy) throw new Error('policy required');

  const store = new FileCounterStore('./data/counters.json');
  await store.load();
  const logger = new JsonlFileLogger('./logs/decisions.jsonl');
  const engine = new PolicyEngine(store, logger);
  engine.loadPolicy(policy, policyHash);

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'POST' && req.url === '/evaluate') {
        const body = await readJson(req);
        const dec = await engine.evaluate(body.intent);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(dec));
        return;
      }
      if (req.method === 'POST' && req.url === '/record') {
        const body = await readJson(req);
        await engine.recordExecution(body);
        res.writeHead(204);
        res.end();
        return;
      }
      if (req.method === 'POST' && req.url === '/pause') {
        const body = await readJson(req);
        engine.setPause(!!body.paused);
        res.writeHead(204);
        res.end();
        return;
      }
      if (req.method === 'POST' && req.url === '/execute') {
        const body = await readJson(req);
        const dec = await engine.evaluate(body.intent);
        if (dec.action === 'allow') {
          await engine.recordExecution({ intent: body.intent, txHash: body.txHash || '0x' + Math.random().toString(16).slice(2) });
        }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(dec));
        return;
      }
      if (req.method === 'POST' && req.url === '/reload') {
        const body = await readJson(req);
        const newPolicy = body.policy;
        if (!newPolicy) throw new Error('policy missing');
        const newHash = computePolicyHash(newPolicy);
        engine.loadPolicy(newPolicy, newHash);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, policyHash: newHash }));
        return;
      }
      res.writeHead(404);
      res.end();
    } catch (e: any) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: e?.message || String(e) }));
    }
  });

  server.listen(port);
  return { server, engine };
}

function readJson(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c as any));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}
