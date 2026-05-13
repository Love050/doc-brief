DocBrief — Single-file SPA

Overview

DocBrief is a single-file HTML/CSS/JS application that helps users create a concise pre-consultation health brief to share with their doctor. It uses the Gemini API to generate an AI assessment from user-provided form data and optional uploaded reports.

Files

- `index.html` — The complete app (UI, styles, JS) located at the workspace root.

How to run

1. Serve the folder over HTTP (recommended) to avoid some browser limitations. From the project folder run one of:

```bash
# Python 3
python -m http.server 8000

# Or (Node.js) if you have http-server installed
npx http-server -p 8000
```

2. Open the app in your browser: `http://localhost:8000/index.html`

API Key

- On first load the app will prompt you to paste your Gemini API key. The key is stored in `localStorage` for convenience.
- You can change it at any time by clicking the `Set API Key` button in the top-right.
- Warning: Using an API key client-side exposes it to end users. For production, proxy requests through a secure server.

Notes & troubleshooting

- CORS: The Gemini endpoint may enforce CORS policies that block direct client-side requests. If you get CORS errors, run a server-side proxy or use a simple server that forwards requests securely.
- Security: Do not expose sensitive API keys in public deployments. Use server-side proxies or environment-based secrets.
- Printing: Use the `Download as PDF` button (prints via `window.print()`). The print view hides UI chrome and prints only the brief.

Next steps I can help with

- Add a small Node.js proxy to keep your key secret (recommended).
- Improve file parsing for PDFs (OCR) or extract lab values.
- Add more translations for languages.

Optional: Run a local Node.js proxy (keeps your API key server-side)

This repository includes a simple built-in Node server you can run to avoid placing your Gemini API key in the browser. The server forwards requests from the front-end to the Gemini endpoint using an API key stored on the server.

Requirements:
- Node.js 18+ (uses global fetch)
- No npm install required

Install and run:

```bash
export GEMINI_API_KEY="YOUR_KEY"   # macOS / Linux
set GEMINI_API_KEY=YOUR_KEY        # Windows (cmd)
node server.js
```

By default the proxy listens on port 3000. In the browser, enable proxy mode for the front-end by running this in the console on the app page before generating:

```js
localStorage.setItem('DOCBRIEF_USE_PROXY','1')
// then reload the page
```

When proxy mode is enabled the front-end will POST to `/generate` on the proxy which will forward the request to Gemini using the server-side `GEMINI_API_KEY`.

Security note: This proxy is a minimal development helper. For production, add authentication, rate limiting, logging, and restrict allowed origins.

Notes about deployment

- If you host the front-end and the proxy on the same domain (the proxy serves static files by default), the app will avoid CORS issues and you won't need to enable proxy mode manually.
- For production, set `ALLOW_ORIGINS` to the comma-separated list of allowed origins for CORS (or leave unset to allow all origins during development).
- Increase `GEMINI_API_KEY` protection: run the proxy in an environment where the server's network and logs are secure.

