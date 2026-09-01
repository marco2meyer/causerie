/* Local relay so a sandboxed browser can reach api.openai.com through the container's
   HTTP proxy. Test infrastructure only — never deployed. */
import http from 'node:http';
import { ProxyAgent, setGlobalDispatcher } from 'undici';

if (process.env.HTTPS_PROXY) setGlobalDispatcher(new ProxyAgent(process.env.HTTPS_PROXY));

const server = http.createServer(async (req, res) => {
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type, openai-beta',
    'access-control-allow-methods': 'GET,POST,OPTIONS'
  };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  try {
    const r = await fetch('https://api.openai.com' + req.url, {
      method: req.method,
      headers: {
        authorization: req.headers['authorization'] || '',
        'content-type': req.headers['content-type'] || 'application/json'
      },
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : body
    });
    const buf = Buffer.from(await r.arrayBuffer());
    res.writeHead(r.status, { ...cors, 'content-type': r.headers.get('content-type') || 'text/plain' });
    res.end(buf);
  } catch (e) {
    res.writeHead(502, cors);
    res.end('relay error: ' + e.message);
  }
});
server.listen(8124, '127.0.0.1', () => console.log('relay on 8124'));
