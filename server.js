/**
 * DayTask — Sync Server
 * Zero-dependency Node.js server that powers cross-device sync.
 *
 *  - Serves the app (index.html, css/, js/)
 *  - Tiny REST API for syncing task data between all your devices:
 *      GET  /api/data  -> returns the current stored payload
 *      POST /api/data  -> merges the posted payload with stored data,
 *                         persists it to disk, and returns the merged result
 *
 * Data is stored in data.json next to this file. No database needed.
 *
 * Run:  node server.js          (default port 3000)
 *       PORT=8080 node server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_FILE = path.join(__dirname, 'data.json');
const PUBLIC_DIR = __dirname;
const MAX_BODY_BYTES = 20 * 1024 * 1024;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.webmanifest': 'application/manifest+json',
    '.txt': 'text/plain; charset=utf-8',
    '.md': 'text/plain; charset=utf-8'
};

// ------------------------------------------------------------------
// Storage
// ------------------------------------------------------------------
function readData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            if (parsed && typeof parsed === 'object') return parsed;
        }
    } catch (e) {
        console.error('[DayTask] Failed to read data file:', e.message);
    }
    return {};
}

function writeData(data) {
    try {
        const dir = path.dirname(DATA_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('[DayTask] Failed to write data file:', e.message);
    }
}

function isDateKey(key) {
    return /^\d{4}-\d{2}-\d{2}$/.test(key);
}

function taskTimestamp(task) {
    if (!task) return '';
    return task.updatedAt || task.createdAt || '';
}

function mergeStores(a, b) {
    const out = {};
    const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);

    const deletedA = (a && a._meta && Array.isArray(a._meta.deleted)) ? a._meta.deleted : [];
    const deletedB = (b && b._meta && Array.isArray(b._meta.deleted)) ? b._meta.deleted : [];
    const deleted = new Set([...deletedA, ...deletedB]);

    for (const key of keys) {
        if (!isDateKey(key)) continue;

        const listA = Array.isArray(a[key]) ? a[key] : [];
        const listB = Array.isArray(b[key]) ? b[key] : [];
        const byId = new Map();

        for (const t of listA) {
            if (t && t.id) byId.set(t.id, t);
        }
        for (const t of listB) {
            if (!t || !t.id) continue;
            const cur = byId.get(t.id);
            if (!cur || taskTimestamp(t) >= taskTimestamp(cur)) byId.set(t.id, t);
        }

        const merged = [...byId.values()].filter(t => !deleted.has(t.id));
        if (merged.length) out[key] = merged;
    }

    out._meta = { deleted: [...deleted], updatedAt: new Date().toISOString() };
    return out;
}

// ------------------------------------------------------------------
// HTTP helpers
// ------------------------------------------------------------------
function setCommonHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('X-Content-Type-Options', 'nosniff');
}

function serveStatic(res, pathname) {
    let rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
    let filePath = path.join(PUBLIC_DIR, rel);

    if (!filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
    }

    fs.stat(filePath, (err, stat) => {
        if (!err && stat.isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
            fs.createReadStream(filePath).pipe(res);
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Not found');
        }
    });
}

function readJsonBody(req, res, callback) {
    let body = '';
    let size = 0;
    let done = false;

    req.on('data', (chunk) => {
        if (done) return;
        size += chunk.length;
        if (size > MAX_BODY_BYTES) {
            done = true;
            req.destroy();
            res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'Payload too large' }));
            return;
        }
        body += chunk;
    });

    req.on('end', () => {
        if (done) return;
        try {
            callback(JSON.parse(body || '{}'));
        } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'Invalid JSON body: ' + e.message }));
        }
    });

    req.on('error', () => {
        done = true;
    });
}

// ------------------------------------------------------------------
// Server
// ------------------------------------------------------------------
const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
    const pathname = url.pathname;

    setCommonHeaders(res);

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (pathname === '/api/data' || pathname === '/api/data/') {
        if (req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(readData()));
            return;
        }

        if (req.method === 'POST') {
            readJsonBody(req, res, (incoming) => {
                const merged = mergeStores(readData(), incoming);
                writeData(merged);
                console.log('[DayTask] Synced data — ' + new Date().toISOString());
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify(merged));
            });
            return;
        }

        res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Method not allowed');
        return;
    }

    if (req.method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Method not allowed');
        return;
    }

    serveStatic(res, pathname);
});

server.listen(PORT, HOST, () => {
    const os = require('os');
    const nets = os.networkInterfaces();
    const addresses = [];
    for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
            if (net.family === 'IPv4' && !net.internal) addresses.push(net.address);
        }
    }

    console.log('');
    console.log('  ┌──────────────────────────────────────────────┐');
    console.log('  │   DayTask Sync Server is running!            │');
    console.log('  └──────────────────────────────────────────────┘');
    console.log('  Local:   http://localhost:' + PORT);
    addresses.forEach(ip => console.log('  Network: http://' + ip + ':' + PORT + '  (open this on your phone)'));
    console.log('  API:     http://localhost:' + PORT + '/api/data');
    console.log('');
});
