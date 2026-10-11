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
const emailService = require('./email-service.js');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DEFAULT_DATA_FILE = path.join(__dirname, 'data.json');
const DEFAULT_PUBLIC_DIR = __dirname;
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
function readData(dataFile = (process.env.DATA_FILE_PATH || DEFAULT_DATA_FILE)) {
    try {
        if (fs.existsSync(dataFile)) {
            const parsed = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
            if (parsed && typeof parsed === 'object') return parsed;
        }
    } catch (e) {
        console.error('[DayTask] Failed to read data file:', e.message);
    }
    return {};
}

function writeData(data, dataFile = (process.env.DATA_FILE_PATH || DEFAULT_DATA_FILE)) {
    try {
        const dir = path.dirname(dataFile);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const tmpFile = `${dataFile}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
        fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf8');
        fs.renameSync(tmpFile, dataFile);
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

    // Track latest occurrence of any task across all dates to prevent duplicates
    const allKnownTasks = new Map();

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
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}

function serveStatic(res, pathname, publicDir = DEFAULT_PUBLIC_DIR) {
    let rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
    const resolvedPublic = path.resolve(publicDir);
    const resolvedPath = path.resolve(publicDir, rel);

    // Path traversal protection
    if (rel.includes('..') || (!resolvedPath.startsWith(resolvedPublic + path.sep) && resolvedPath !== path.join(resolvedPublic, 'index.html'))) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
    }

    // Block sensitive server files and hidden files
    const filename = path.basename(resolvedPath);
    if (filename.startsWith('.') || ['server.js', 'package.json', 'package-lock.json', 'data.json'].includes(filename)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
    }

    fs.stat(resolvedPath, (err, stat) => {
        if (!err && stat.isFile()) {
            const ext = path.extname(resolvedPath).toLowerCase();
            const headers = {
                'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
                'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
            };
            res.writeHead(200, headers);
            fs.createReadStream(resolvedPath).pipe(res);
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
            const parsed = JSON.parse(body || '{}');
            callback(parsed);
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
// Server Factory
// ------------------------------------------------------------------
function createServer({ dataFile = (process.env.DATA_FILE_PATH || DEFAULT_DATA_FILE), publicDir = DEFAULT_PUBLIC_DIR } = {}) {
    return http.createServer(async (req, res) => {
        const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
        const pathname = url.pathname;

        setCommonHeaders(res);

        if (req.url.includes('..')) {
            res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Forbidden');
            return;
        }

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        if (pathname === '/api/data' || pathname === '/api/data/') {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

            if (req.method === 'GET') {
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify(readData(dataFile)));
                return;
            }

            if (req.method === 'POST') {
                readJsonBody(req, res, (incoming) => {
                    const current = readData(dataFile);
                    const merged = mergeStores(current, incoming);
                    writeData(merged, dataFile);
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify(merged));

                    // Evaluate high-priority task alerts on new/updated tasks asynchronously
                    emailService.checkAndSendAlerts(merged).catch(err => {
                        console.error('[DayTask Email] Post-sync alert check error:', err.message);
                    });
                });
                return;
            }

            res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Method not allowed');
            return;
        }

        // Email Alert Status & Configuration
        if (pathname === '/api/email-status' || pathname === '/api/email-status/') {
            res.setHeader('Cache-Control', 'no-store, no-cache');
            if (req.method === 'GET') {
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                    enabled: true,
                    notifyEmail: emailService.CONFIG.notifyEmail,
                    smtpHost: emailService.CONFIG.smtpHost,
                    spreadsheetUrl: emailService.CONFIG.spreadsheetUrl,
                    spreadsheetSchedule: emailService.SPREADSHEET_SCHEDULE.map(s => s.label)
                }));
                return;
            }
            res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Method not allowed');
            return;
        }

        // Send Test Alert Email Immediately
        if (pathname === '/api/send-test-email' || pathname === '/api/send-test-email/') {
            res.setHeader('Cache-Control', 'no-store, no-cache');
            if (req.method === 'POST') {
                readJsonBody(req, res, async (body) => {
                    try {
                        const subject = 'Remainder Alert: Test Notification from DayTask';
                        const html = emailService.renderSpreadsheetReminderHtml('Manual Test');
                        await emailService.sendSmtpMail({ subject, html });
                        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({
                            success: true,
                            message: `Test email successfully delivered to ${emailService.CONFIG.notifyEmail}`
                        }));
                    } catch (err) {
                        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({ success: false, error: err.message }));
                    }
                });
                return;
            }
            res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Method not allowed');
            return;
        }

        // Trigger Immediate Check & Dispatch of High Alerts and Scheduled Sheet Emails
        if (pathname === '/api/check-email-alerts' || pathname === '/api/check-email-alerts/') {
            res.setHeader('Cache-Control', 'no-store, no-cache');
            if (req.method === 'POST') {
                try {
                    const current = readData(dataFile);
                    const result = await emailService.checkAndSendAlerts(current);
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: true, result }));
                } catch (err) {
                    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, error: err.message }));
                }
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

        serveStatic(res, pathname, publicDir);
    });
}

// ------------------------------------------------------------------
// Background Email Alert Scheduler
// ------------------------------------------------------------------
function startEmailAlertScheduler(dataFile = (process.env.DATA_FILE_PATH || DEFAULT_DATA_FILE)) {
    // Initial check after 4 seconds
    setTimeout(() => {
        const data = readData(dataFile);
        emailService.checkAndSendAlerts(data).catch(err => {
            console.error('[DayTask Scheduler] Alert check failed:', err.message);
        });
    }, 4000);

    // Periodic check every 60 seconds
    return setInterval(() => {
        const data = readData(dataFile);
        emailService.checkAndSendAlerts(data).catch(err => {
            console.error('[DayTask Scheduler] Alert check failed:', err.message);
        });
    }, 60000);
}

// ------------------------------------------------------------------
// Main Entry
// ------------------------------------------------------------------
if (require.main === module) {
    const server = createServer();
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
        console.log('  Email:   SMTP Alerts -> ' + emailService.CONFIG.notifyEmail);
        console.log('  Sheets:  Checkpoints at 11:00 AM, 12:00 PM, 4:00 PM, 8:00 PM');
        console.log('');

        // Start background email scheduler (runs even if website is closed)
        startEmailAlertScheduler();
    });
}

module.exports = {
    createServer,
    readData,
    writeData,
    mergeStores,
    isDateKey,
    taskTimestamp,
    serveStatic,
    startEmailAlertScheduler,
    DEFAULT_DATA_FILE,
    DEFAULT_PUBLIC_DIR,
    MIME_TYPES
};
