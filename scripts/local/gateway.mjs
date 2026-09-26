#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Local API gateway for the Docker-free dev stack (scripts/local/stack.sh).
//
//   http://127.0.0.1:54321/auth/v1/*  -> Supabase Auth (GoTrue) on :9999
//   http://127.0.0.1:54321/rest/v1/*  -> PostgREST on :3000
//   http://127.0.0.1:54321/__mail     -> JSON list of captured e-mails
//
// It also runs a tiny SMTP sink on :2500 so magic links, one-time codes and
// confirmation mails can be read locally. Development use only.
// -----------------------------------------------------------------------------
import http from 'node:http';
import net from 'node:net';

const GATEWAY_PORT = Number(process.env.GATEWAY_PORT ?? 54321);
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 2500);
const ROUTES = [
  { prefix: '/auth/v1', host: '127.0.0.1', port: Number(process.env.AUTH_PORT ?? 9999) },
  { prefix: '/rest/v1', host: '127.0.0.1', port: Number(process.env.REST_PORT ?? 3000) },
];

const mails = [];

function cors(res, req) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD');
  res.setHeader(
    'Access-Control-Allow-Headers',
    req.headers['access-control-request-headers'] ??
      'authorization,apikey,content-type,x-client-info,prefer,range,accept-profile,content-profile',
  );
  res.setHeader('Access-Control-Expose-Headers', 'content-range,x-total-count,content-profile');
  res.setHeader('Access-Control-Max-Age', '600');
}

const server = http.createServer((req, res) => {
  cors(res, req);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  const url = req.url ?? '/';
  if (url.startsWith('/__mail')) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify([...mails].reverse(), null, 2));
    return;
  }
  const route = ROUTES.find(
    (r) => url === r.prefix || url.startsWith(`${r.prefix}/`) || url.startsWith(`${r.prefix}?`),
  );
  if (!route) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: `No local service for ${url}` }));
    return;
  }
  const upstreamPath = url.slice(route.prefix.length) || '/';
  const headers = { ...req.headers, host: `${route.host}:${route.port}` };
  const upstream = http.request(
    { host: route.host, port: route.port, method: req.method, path: upstreamPath, headers },
    (upRes) => {
      const outHeaders = { ...upRes.headers };
      for (const key of Object.keys(outHeaders)) {
        if (key.toLowerCase().startsWith('access-control-')) delete outHeaders[key];
      }
      // Keep our CORS headers (already set on res) and forward the rest.
      for (const [key, value] of Object.entries(outHeaders)) {
        if (value !== undefined) res.setHeader(key, value);
      }
      res.writeHead(upRes.statusCode ?? 502);
      upRes.pipe(res);
    },
  );
  upstream.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: `Upstream error: ${err.message}` }));
  });
  req.pipe(upstream);
});

server.listen(GATEWAY_PORT, '127.0.0.1', () => {
  console.log(`gateway listening on http://127.0.0.1:${GATEWAY_PORT}`);
});

// --------------------------------------------------------------- SMTP sink --
function decodeQuotedPrintable(text) {
  return text
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function parseMail(raw) {
  const [head, ...rest] = raw.split(/\r?\n\r?\n/);
  const body = rest.join('\n\n');
  const header = (name) => {
    const match = new RegExp(`^${name}:\\s*(.*)$`, 'im').exec(head ?? '');
    return match ? match[1].trim() : '';
  };
  const decoded = /quoted-printable/i.test(raw) ? decodeQuotedPrintable(body) : body;
  const links = [...decoded.matchAll(/https?:\/\/[^\s"'<>]+/g)].map((m) =>
    m[0].replace(/&amp;/g, '&'),
  );
  const code = /\b(\d{6})\b/.exec(decoded.replace(/https?:\/\/[^\s"'<>]+/g, ''))?.[1] ?? null;
  return {
    to: header('To'),
    subject: header('Subject'),
    links,
    code,
    receivedAt: new Date().toISOString(),
  };
}

const smtp = net.createServer((socket) => {
  let inData = false;
  let buffer = '';
  let dataLines = [];
  const reply = (line) => socket.write(`${line}\r\n`);
  reply('220 applyhub-local ESMTP');
  socket.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    let index;
    while ((index = buffer.indexOf('\r\n')) >= 0) {
      const line = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      if (inData) {
        if (line === '.') {
          inData = false;
          const mail = parseMail(dataLines.join('\r\n'));
          mails.push(mail);
          if (mails.length > 200) mails.shift();
          console.log(`mail to ${mail.to}: ${mail.subject}`);
          dataLines = [];
          reply('250 OK queued');
        } else {
          dataLines.push(line.startsWith('..') ? line.slice(1) : line);
        }
        continue;
      }
      const cmd = line.slice(0, 4).toUpperCase();
      if (cmd === 'EHLO') {
        reply('250-applyhub-local');
        reply('250-8BITMIME');
        reply('250 AUTH PLAIN LOGIN');
      } else if (cmd === 'HELO') reply('250 applyhub-local');
      else if (cmd === 'AUTH') reply('235 Authentication successful');
      else if (cmd === 'MAIL' || cmd === 'RCPT' || cmd === 'RSET' || cmd === 'NOOP')
        reply('250 OK');
      else if (cmd === 'DATA') {
        inData = true;
        reply('354 End data with <CR><LF>.<CR><LF>');
      } else if (cmd === 'QUIT') {
        reply('221 Bye');
        socket.end();
      } else reply('250 OK');
    }
  });
  socket.on('error', () => {});
});

smtp.listen(SMTP_PORT, '127.0.0.1', () => {
  console.log(`smtp sink listening on 127.0.0.1:${SMTP_PORT}`);
});
