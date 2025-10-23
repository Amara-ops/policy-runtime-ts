import http from 'node:http';
import path from 'node:path';
import { PolicyEngine, FileCounterStore, JsonlFileLogger } from '../index.js';
import { computePolicyHash } from '../util/policyHash.js';
import { normalizeAndValidatePolicy } from '../policy.js';

let decisionCount = 0;
let allowCount = 0;
let denyCount = 0;

async function pingSidecar(host: string, port: number, authToken?: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const req = http.request({ host, port, path: '/metrics', method: 'GET', timeout: 500, headers: authToken ? { 'authorization': `Bearer ${authToken}` } : undefined }, (res) => {
      const status = res.statusCode || 0;
      if (status === 200 || status === 401 || status === 403) {
        let buf = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { buf += c; });
        res.on('end', () => { resolve(true); });
      } else {
        resolve(false);
      }
    });
    req.on('timeout', () => { try { req.destroy(); } catch {} resolve(false); });
    req.on('error', () => resolve(false));
    req.end();
  });
}

export async function startServer(opts?: { port?: number; host?: string; authToken?: string; policy: any; policyHash?: string; logsPath?: string }): Promise<{ server?: http.Server; engine?: PolicyEngine; alreadyRunning?: boolean; logsPath?: string }> {
  const port = opts?.port ?? 8787;
  const host = opts?.host ?? '127.0.0.1';
  const authToken = opts?.authToken;
  const policyRaw = opts?.policy;
  const logsPath = path.resolve(opts?.logsPath || process.env.POLICY_RUNTIME_LOG_PATH || './logs/decisions.jsonl');
  if (!policyRaw) throw new Error('policy required');

  const occupied = await pingSidecar(host, port, authToken);
  if (occupied) {
    return { alreadyRunning: true };
  }

  const policy = normalizeAndValidatePolicy(policyRaw);
  const policyHash = opts?.policyHash ?? computePolicyHash(policy);

  const store = new FileCounterStore('./data/counters.json');
  await store.load();
  const logger = new JsonlFileLogger(logsPath);
  const engine = new PolicyEngine(store, logger);
  engine.loadPolicy(policy, policyHash);

  try {
    process.on('SIGHUP', () => { try { (logger as any).reopen?.(); } catch {} });
  } catch {}

  const server = http.createServer(async (req, res) => {
    try {
      if (authToken) {
        const hdr = req.headers['authorization'];
        const ok = typeof hdr === 'string' && hdr.startsWith('Bearer ') && hdr.slice(7) === authToken;
        if (!ok) { res.writeHead(401); res.end(); return; }
      }

      if (req.method === 'GET' && req.url === '/status') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, policyHash, paused: !!engine['policy']?.pause, decisions_total: decisionCount, allow_total: allowCount, deny_total: denyCount, logs_path: logsPath }));
        return;
      }
      if (req.method === 'POST' && req.url === '/reopen_logs') {
        (logger as any).reopen?.();
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (req.method === 'POST' && req.url === '/evaluate') {
        const body = await readJson(req);
        const dec = await engine.evaluate(body.intent);
        decisionCount++; if (dec.action === 'allow') allowCount++; else if (dec.action === 'deny') denyCount++;
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
        decisionCount++; if (dec.action === 'allow') allowCount++; else if (dec.action === 'deny') denyCount++;
        if (dec.action === 'allow') {
          await engine.recordExecution({ intent: body.intent, txHash: body.txHash || '0x' + Math.random().toString(16).slice(2) });
        }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(dec));
        return;
      }
      if (req.method === 'POST' && req.url === '/reload') {
        const body = await readJson(req);
        const newPolicyRaw = body.policy;
        if (!newPolicyRaw) throw new Error('policy missing');
        const newPolicy = normalizeAndValidatePolicy(newPolicyRaw);
        const newHash = computePolicyHash(newPolicy);
        engine.loadPolicy(newPolicy, newHash);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, policyHash: newHash }));
        return;
      }
      if (req.method === 'GET' && req.url === '/metrics') {
        let txt = '';
        txt += '# HELP policy_runtime_decisions_total Total decisions returned by the runtime\n';
        txt += '# TYPE policy_runtime_decisions_total counter\n';
        txt += `policy_runtime_decisions_total ${decisionCount}\n`;
        txt += '# HELP policy_runtime_decisions_by_action_total Decisions by action\n';
        txt += '# TYPE policy_runtime_decisions_by_action_total counter\n';
        txt += `policy_runtime_decisions_by_action_total{action=\"allow\"} ${allowCount}\n`;
        txt += `policy_runtime_decisions_by_action_total{action=\"deny\"} ${denyCount}\n`;
        res.writeHead(200, { 'content-type': 'text/plain; version=0.0.4' });
        res.end(txt);
        return;
      }
      res.writeHead(404);
      res.end();
    } catch (e: any) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: e?.message || String(e) }));
    }
  });

  let addrInUse = false;
  await new Promise<void>((resolve, reject) => {
    server.once('error', async (err: any) => {
      if (err?.code === 'EADDRINUSE') {
        const active = await pingSidecar(host, port, authToken);
        if (active) {
          addrInUse = true;
          return resolve();
        }
      }
      reject(err);
    });
    server.listen(port, host, () => resolve());
  });

  if (addrInUse) {
    try { server.close(); } catch {}
    return { alreadyRunning: true, logsPath };
  }

  return { server, engine, logsPath };
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
