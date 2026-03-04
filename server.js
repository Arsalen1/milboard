const express = require('express');
const cors = require('cors');
const https = require('https');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files — works for both /public/index.html and /index.html
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// Root route — find index.html wherever it is
app.get('/', (req, res) => {
  const p1 = path.join(__dirname, 'public', 'index.html');
  const p2 = path.join(__dirname, 'index.html');
  if (fs.existsSync(p1)) return res.sendFile(p1);
  if (fs.existsSync(p2)) return res.sendFile(p2);
  res.send('<h1>✅ milboard server running</h1><p>Put index.html in /public/ or root</p>');
});

const PORT = process.env.PORT || 3000;
const AIS_KEY = process.env.AIS_KEY || '82a2564216a5c0e2ca666097d7652f6982528356';

// ─── Simple fetch helper ────────────────────────────────────
function fetchURL(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, { headers: { 'User-Agent': 'MilBoard/1.0' } }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, text: data }));
    }).on('error', reject);
  });
}

// ─── 1. OpenSky ─────────────────────────────────────────────
app.get('/api/flights', async (req, res) => {
  try {
    const url = 'https://opensky-network.org/api/states/all?lamin=10&lomin=30&lamax=42&lomax=65';
    const r = await fetchURL(url);
    if (r.status !== 200) return res.status(502).json({ error: 'OpenSky HTTP ' + r.status });
    const data = JSON.parse(r.text);
    const states = (data.states || []).filter(s => s[5] && s[6]);
    const flights = states.map(s => ({
      icao: s[0], callsign: (s[1] || '').trim() || 'N/A',
      country: s[2] || '--', lon: s[5], lat: s[6],
      alt: s[7] ? Math.round(s[7]) : null,
      vel: s[9] ? Math.round(s[9] * 3.6) : null,
      heading: s[10] || 0, onGround: s[8]
    }));
    res.json({ count: flights.length, flights, time: Date.now() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── 2. NASA FIRMS ──────────────────────────────────────────
app.get('/api/fires', async (req, res) => {
  try {
    const url = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv/VIIRS_SNPP_NRT/24h/10,30,42,65';
    const r = await fetchURL(url);
    if (r.status !== 200) return res.status(502).json({ error: 'NASA HTTP ' + r.status });
    const lines = r.text.trim().split('\n');
    if (lines.length < 2) return res.json({ count: 0, fires: [] });
    const header = lines[0].split(',');
    const latI = header.findIndex(h => h.toLowerCase().includes('latitude'));
    const lonI = header.findIndex(h => h.toLowerCase().includes('longitude'));
    const brtI = header.findIndex(h => h.toLowerCase().includes('bright'));
    const datI = header.findIndex(h => h.toLowerCase().includes('acq_date'));
    const fires = lines.slice(1).map(l => {
      const c = l.split(',');
      return { lat: parseFloat(c[latI]), lon: parseFloat(c[lonI]), bright: parseFloat(c[brtI]), date: c[datI] };
    }).filter(f => !isNaN(f.lat) && !isNaN(f.lon));
    res.json({ count: fires.length, fires, time: Date.now() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── 3. Red Alert ───────────────────────────────────────────
app.get('/api/redalert', async (req, res) => {
  try {
    const r = await fetchURL('https://www.oref.org.il/WarningMessages/alert/alerts.json');
    if (r.status === 200 && r.text && r.text.trim().length > 10) {
      try {
        const data = JSON.parse(r.text.trim().replace(/^\uFEFF/, ''));
        return res.json({ source: 'oref', alerts: data.data || [], time: Date.now() });
      } catch (_) {}
    }
    res.json({ source: 'none', alerts: [], time: Date.now() });
  } catch (e) { res.json({ source: 'error', alerts: [], error: e.message, time: Date.now() }); }
});

// ─── 4. Red Alert History ───────────────────────────────────
app.get('/api/redalert/history', async (req, res) => {
  try {
    const r = await fetchURL('https://www.oref.org.il/warningMessages/alert/History/AlertsHistory.json');
    if (r.status === 200 && r.text.trim().length > 10) {
      const data = JSON.parse(r.text.trim().replace(/^\uFEFF/, ''));
      const recent = Array.isArray(data) ? data.slice(0, 50) : [];
      return res.json({ count: recent.length, history: recent, time: Date.now() });
    }
    res.json({ count: 0, history: [], time: Date.now() });
  } catch (e) { res.json({ count: 0, history: [], error: e.message, time: Date.now() }); }
});

// ─── 5. AISstream WebSocket proxy ───────────────────────────
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ais-ws' });

wss.on('connection', clientWs => {
  let aisWs = null;
  try {
    aisWs = new WebSocket('wss://stream.aisstream.io/v0/stream');
    aisWs.on('open', () => {
      aisWs.send(JSON.stringify({
        APIKey: AIS_KEY,
        BoundingBoxes: [[[10, 30], [42, 65]], [[10, 32], [30, 45]]],
        FilterMessageTypes: ['PositionReport', 'ShipStaticData']
      }));
      clientWs.send(JSON.stringify({ type: 'status', msg: 'connected' }));
    });
    aisWs.on('message', data => { if (clientWs.readyState === WebSocket.OPEN) clientWs.send(data.toString()); });
    aisWs.on('error', e => { if (clientWs.readyState === WebSocket.OPEN) clientWs.send(JSON.stringify({ type: 'error', msg: e.message })); });
    aisWs.on('close', () => { if (clientWs.readyState === WebSocket.OPEN) clientWs.send(JSON.stringify({ type: 'status', msg: 'disconnected' })); });
  } catch (e) { clientWs.send(JSON.stringify({ type: 'error', msg: e.message })); }
  clientWs.on('close', () => { if (aisWs) aisWs.close(); });
});

// ─── Health check ────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

server.listen(PORT, () => console.log(`✅ MilBoard server on port ${PORT}`));
