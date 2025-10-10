/* eslint-disable */
import http from 'node:http';
import { startServer } from '../http/server.js';

const policy = {
  allowlist: [
    { chainId: 8453, to: '0x0000000000000000000000000000000000000001', selector: '0xaaaaaaaa' }
  ],
  caps: { max_outflow_h1: '1000', max_outflow_d1: '2000' },
  pause: false
};

function req(method: string, path: string, body?: any): Promise<{ status: number, json?: any }> {
  return new Promise((resolve) => {
    const data = body ? Buffer.from(JSON.stringify(body)) : undefined;
    const req = http.request({ hostname: '127.0.0.1', port: 8789, path, method, headers: { 'content-type': 'application/json', 'content-length': data?.length || 0 }}, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c as any));
      res.on('end', () => {
        const txt = Buffer.concat(chunks).toString('utf8');
        try { resolve({ status: res.statusCode || 0, json: txt ? JSON.parse(txt) : undefined }); }
        catch { resolve({ status: res.statusCode || 0 }); }
      });
    });
    if (data) req.write(data);
    req.end();
  });
}

it('HTTP server evaluate/record/pause', async () => {
  const { server } = await startServer({ port: 8789, policy, policyHash: '0x' + 'ee'.repeat(32) });
  try {
    const intent = { chainId: 8453, to: '0x0000000000000000000000000000000000000001', selector: '0xaaaaaaaa', denomination: 'BASE_USDC', amount: '600' };

    const a = await req('POST', '/evaluate', { intent });
    expect(a.status).toBe(200);
    expect(a.json.action).toBe('allow');

    await req('POST', '/record', { intent, txHash: '0x99' });

    const b = await req('POST', '/evaluate', { intent });
    expect(b.json.action).toBe('deny');

    await req('POST', '/pause', { paused: true });
    const c = await req('POST', '/evaluate', { intent });
    expect(c.json.reasons).toContain('PAUSED');
  } finally {
    server.close();
  }
});
