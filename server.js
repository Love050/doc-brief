// DocBrief dependency-free Node server
// Serves static files and proxies Gemini requests through a server-side API key.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const port = process.env.PORT || 3000;
const rootDir = __dirname;
const apiKey = process.env.GEMINI_API_KEY || '';
const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const fallbackModels = [
  modelName,
  'gemini-2.5-flash-preview-05-20',
  'gemini-2.0-flash'
].filter((model, index, array) => array.indexOf(model) === index);
const allowOrigins = (process.env.ALLOW_ORIGINS || '*').split(',').map(s => s.trim()).filter(Boolean);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Content-Type': headers['Content-Type'] || 'application/json; charset=utf-8',
    ...headers
  });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || '*';
  if (allowOrigins.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (allowOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function safeJoin(base, target) {
  const targetPath = '.' + path.normalize('/' + target).replace(/^\.+/, '');
  const resolved = path.join(base, targetPath);
  if (!resolved.startsWith(base)) return null;
  return resolved;
}

function serveStatic(req, res, pathname) {
  let filePath = pathname === '/' ? path.join(rootDir, 'index.html') : safeJoin(rootDir, pathname);
  if (!filePath) return send(res, 403, { error: 'Forbidden' });
  fs.stat(filePath, (err, stat) => {
    if (err) return send(res, 404, { error: 'Not found' });
    if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');
    const ext = path.extname(filePath).toLowerCase();
    const type = mimeTypes[ext] || 'application/octet-stream';
    fs.readFile(filePath, (readErr, data) => {
      if (readErr) return send(res, 500, { error: 'Failed to read file' });
      res.writeHead(200, { 'Content-Type': type });
      res.end(data);
    });
  });
}

async function handleGenerate(req, res, bodyText) {
  if (!apiKey) return send(res, 500, { error: 'Server missing GEMINI_API_KEY environment variable.' });

  let payload;
  try {
    payload = JSON.parse(bodyText || '{}');
  } catch (err) {
    return send(res, 400, { error: 'Invalid JSON body.' });
  }

  // Apply low-cost defaults unless the client explicitly sets stricter limits.
  payload.generationConfig = payload.generationConfig || {};
  if (typeof payload.generationConfig.maxOutputTokens !== 'number') {
    payload.generationConfig.maxOutputTokens = 700;
  }
  if (typeof payload.generationConfig.temperature !== 'number') {
    payload.generationConfig.temperature = 0.2;
  }
  if (typeof payload.generationConfig.topP !== 'number') {
    payload.generationConfig.topP = 0.8;
  }
  payload.generationConfig.thinkingConfig = payload.generationConfig.thinkingConfig || {};
  payload.generationConfig.thinkingConfig.thinkingBudget = 0;

  async function callGemini(model) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const text = await response.text();
    return { response, text };
  }

  let response;
  let text;
  for (const model of fallbackModels) {
    ({ response, text } = await callGemini(model));
    if (response.ok) break;
    if (response.status === 404 && /not found|not supported/i.test(text || '')) continue;
    if (response.status === 429 && /quota|resource_exhausted|rate limit/i.test(text || '')) continue;
    break;
  }

  res.writeHead(response.status, {
    'Content-Type': response.headers.get('content-type') || 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': allowOrigins.includes('*') ? '*' : (req.headers.origin || '*')
  });
  res.end(text);
}

const server = http.createServer((req, res) => {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const requestUrl = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && requestUrl.pathname === '/health') {
    return send(res, 200, { ok: true });
  }

  if (req.method === 'POST' && requestUrl.pathname === '/generate') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) {
        req.destroy();
      }
    });
    req.on('end', () => {
      handleGenerate(req, res, body).catch(err => {
        console.error('Proxy error', err);
        send(res, 500, { error: String(err) });
      });
    });
    return;
  }

  if (req.method === 'GET') {
    return serveStatic(req, res, requestUrl.pathname);
  }

  send(res, 405, { error: 'Method not allowed' });
});

server.listen(port, () => {
  console.log(`DocBrief server listening on http://localhost:${port}`);
});
