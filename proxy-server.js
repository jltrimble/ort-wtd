/**
 * Qualia API CORS Proxy Server
 * 
 * Forwards GraphQL requests from your local dashboard to the Qualia Platform API,
 * adding the proper auth headers and bypassing browser CORS restrictions.
 * 
 * Usage:
 *   node proxy-server.js
 * 
 * Then open qualia-dashboard.html in your browser — it will connect via
 * http://localhost:3001/api/graphql
 */

const express = require('express');
const cors = require('cors');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const app = express();
const PORT = 3001;

// ─── Configuration ───────────────────────────────────────────────
const QUALIA_ENDPOINT = 'https://ort-wtd.qualia.io/api/platform/graphql';
const QUALIA_AUTH = 'Basic b3J0LXd0ZC1hcGktdXNlcjpLT2JBaDVLUjdTNUFIOGJjT3A2WDdIY0wxU3A3UTZxY1d2T0NSQ1I0SGND';
// ─────────────────────────────────────────────────────────────────

// Allow all origins for local dev
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Serve the dashboard HTML from the same directory
app.use(express.static(__dirname));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', target: QUALIA_ENDPOINT });
});

// Proxy endpoint — forwards POST requests to Qualia's GraphQL API
app.post('/api/graphql', (req, res) => {
  const body = JSON.stringify(req.body);
  const target = new URL(QUALIA_ENDPOINT);

  const options = {
    hostname: target.hostname,
    port: target.port || 443,
    path: target.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': QUALIA_AUTH,
      'Content-Length': Buffer.byteLength(body),
    },
  };

  console.log(`[${new Date().toLocaleTimeString()}] → POST ${QUALIA_ENDPOINT}`);

  const proxyReq = https.request(options, (proxyRes) => {
    let data = '';
    proxyRes.on('data', (chunk) => { data += chunk; });
    proxyRes.on('end', () => {
      const status = proxyRes.statusCode;
      console.log(`[${new Date().toLocaleTimeString()}] ← ${status} (${data.length} bytes)`);

      res.status(status);
      // Forward relevant headers
      if (proxyRes.headers['content-type']) {
        res.setHeader('Content-Type', proxyRes.headers['content-type']);
      }
      res.send(data);
    });
  });

  proxyReq.on('error', (err) => {
    console.error(`[${new Date().toLocaleTimeString()}] ✖ Proxy error:`, err.message);
    res.status(502).json({ error: 'Proxy error', message: err.message });
  });

  proxyReq.write(body);
  proxyReq.end();
});

// Start server
app.listen(PORT, () => {
  console.log('');
  console.log('  ┌──────────────────────────────────────────────────┐');
  console.log('  │                                                  │');
  console.log('  │   🟢  Qualia API Proxy Server Running            │');
  console.log('  │                                                  │');
  console.log(`  │   Dashboard:  http://localhost:${PORT}              │`);
  console.log(`  │   API Proxy:  http://localhost:${PORT}/api/graphql  │`);
  console.log(`  │   Target:     ort-wtd.qualia.io                  │`);
  console.log('  │                                                  │');
  console.log('  │   Open the dashboard URL above in your browser.  │');
  console.log('  │   Press Ctrl+C to stop.                          │');
  console.log('  │                                                  │');
  console.log('  └──────────────────────────────────────────────────┘');
  console.log('');
});
