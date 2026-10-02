// Journalise en-têtes ET corps bruts de tout ce qui arrive (détection d'une signature éventuelle).
import http from 'node:http';
import { appendFileSync, mkdirSync } from 'node:fs';
mkdirSync(new URL('./logs/', import.meta.url), { recursive: true });
const port = Number(process.env.PORT ?? 3001);
http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const entry = { at: new Date().toISOString(), method: req.method, url: req.url,
      remote: req.socket.remoteAddress, headers: req.headers, rawBody: Buffer.concat(chunks).toString('utf8') };
    appendFileSync(new URL('./logs/webhooks.jsonl', import.meta.url), JSON.stringify(entry) + '\n');
    console.log(JSON.stringify(entry, null, 2));
    res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
  });
}).listen(port, () => console.log(`webhook receiver on :${port}`));
