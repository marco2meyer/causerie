/* e2e bridge: serves dist/ statically and forwards /api/* to the production deployment,
 * so the suite can run in sandboxes with no OpenAI key at hand (ACCESS_CODE auth) and
 * no direct HTTPS egress from the browser. /api/health is rewritten to the access-code
 * flavor so the legacy signup form renders (production itself is Google/Supabase-only).
 * Test infrastructure only — never deployed. */
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ProxyAgent, setGlobalDispatcher, fetch as ufetch } from 'undici';

/* Short keep-alive: the sandbox proxy drops idle connections and undici would
 * otherwise hang forever reusing a dead pooled socket. */
if (process.env.HTTPS_PROXY) {
  setGlobalDispatcher(new ProxyAgent({
    uri: process.env.HTTPS_PROXY,
    keepAliveTimeout: 900, keepAliveMaxTimeout: 900,
    headersTimeout: 30000, bodyTimeout: 180000
  }));
}

const PORT = Number(process.argv[2] || 8123);
const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../dist');
const PROD = process.env.E2E_PROD || 'https://causerie-marco.netlify.app';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

http.createServer(async (req, res) => {
  if (req.url === '/api/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, auth: 'code', googleClientId: null, keyConfigured: true, supabaseUrl: null, supabaseKey: null }));
  }
  if (req.url.startsWith('/api/')) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    try {
      const h = { 'content-type': req.headers['content-type'] || 'application/json' };
      for (const k of ['authorization', 'x-access-code', 'x-sync-token']) {
        if (req.headers[k]) h[k] = req.headers[k];
      }
      const body = ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks);
      let r;
      try {
        r = await ufetch(PROD + req.url, { method: req.method, headers: h, body });
      } catch {
        r = await ufetch(PROD + req.url, { method: req.method, headers: h, body }); // one retry on a stale socket
      }
      res.writeHead(r.status, { 'content-type': r.headers.get('content-type') || 'application/json' });
      if (r.body) for await (const chunk of r.body) res.write(chunk); // streams SSE too
      res.end();
    } catch (e) { res.writeHead(502); res.end('bridge error: ' + e.message); }
    return;
  }
  let p = path.join(DIST, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(DIST) || !existsSync(p) || statSync(p).isDirectory()) p = path.join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  createReadStream(p).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log('bridge on ' + PORT + ' → ' + PROD));
