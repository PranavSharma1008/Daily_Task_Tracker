const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createServer } = require('../server.js');

function createTempEnv() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'daytask-test-'));
    const tempDb = path.join(tempDir, 'data.json');
    return { tempDir, tempDb };
}

function request(server, options, requestBody = null) {
    return new Promise((resolve, reject) => {
        const address = server.address();
        const reqOpts = {
            host: '127.0.0.1',
            port: address.port,
            path: options.path,
            method: options.method || 'GET',
            headers: options.headers || {}
        };

        const req = http.request(reqOpts, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                let json = null;
                try {
                    json = JSON.parse(data);
                } catch (e) {}
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: data,
                    json
                });
            });
        });

        req.on('error', reject);
        if (requestBody) req.write(requestBody);
        req.end();
    });
}

test('Server — GET & POST /api/data with atomic storage', async () => {
    const { tempDir, tempDb } = createTempEnv();
    const server = createServer({ dataFile: tempDb, publicDir: path.join(__dirname, '..') });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

    try {
        // 1. Initial GET /api/data returns empty data object
        const getRes1 = await request(server, { path: '/api/data' });
        assert.strictEqual(getRes1.status, 200);
        assert.deepStrictEqual(getRes1.json, {});

        // 2. POST /api/data with tasks
        const payload = {
            '2026-08-15': [
                { id: 'task-100', title: 'Test Task', completed: false, updatedAt: '2026-08-15T12:00:00Z' }
            ]
        };
        const postRes = await request(server, {
            path: '/api/data',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, JSON.stringify(payload));

        assert.strictEqual(postRes.status, 200);
        assert.strictEqual(postRes.json['2026-08-15'].length, 1);
        assert.strictEqual(postRes.json['2026-08-15'][0].id, 'task-100');

        // 3. Verify file was written atomically on disk
        assert.strictEqual(fs.existsSync(tempDb), true);
        const onDisk = JSON.parse(fs.readFileSync(tempDb, 'utf8'));
        assert.strictEqual(onDisk['2026-08-15'][0].id, 'task-100');

        // 4. Second GET returns stored data
        const getRes2 = await request(server, { path: '/api/data' });
        assert.strictEqual(getRes2.status, 200);
        assert.strictEqual(getRes2.json['2026-08-15'][0].title, 'Test Task');
    } finally {
        server.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('Server — Static file serving & MIME types', async () => {
    const { tempDir, tempDb } = createTempEnv();
    const server = createServer({ dataFile: tempDb, publicDir: path.join(__dirname, '..') });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

    try {
        // GET / serves index.html
        const homeRes = await request(server, { path: '/' });
        assert.strictEqual(homeRes.status, 200);
        assert.strictEqual(homeRes.headers['content-type'], 'text/html; charset=utf-8');
        assert.match(homeRes.body, /<title>DayTask/);

        // GET /css/styles.css serves stylesheet
        const cssRes = await request(server, { path: '/css/styles.css' });
        assert.strictEqual(cssRes.status, 200);
        assert.strictEqual(cssRes.headers['content-type'], 'text/css; charset=utf-8');
        assert.match(cssRes.body, /--primary/);

        // GET /js/app.js serves JavaScript
        const jsRes = await request(server, { path: '/js/app.js' });
        assert.strictEqual(jsRes.status, 200);
        assert.strictEqual(jsRes.headers['content-type'], 'application/javascript; charset=utf-8');
        assert.match(jsRes.body, /DayTask/);

        // GET non-existent file returns 404
        const notFoundRes = await request(server, { path: '/not-found-xyz.html' });
        assert.strictEqual(notFoundRes.status, 404);
    } finally {
        server.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('Server — Security protections (block sensitive & hidden files)', async () => {
    const { tempDir, tempDb } = createTempEnv();
    const server = createServer({ dataFile: tempDb, publicDir: path.join(__dirname, '..') });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

    try {
        // Direct static access to server.js must be Forbidden (403)
        const serverJsRes = await request(server, { path: '/server.js' });
        assert.strictEqual(serverJsRes.status, 403);

        // Direct static access to package.json must be Forbidden (403)
        const pkgRes = await request(server, { path: '/package.json' });
        assert.strictEqual(pkgRes.status, 403);

        // Direct static access to data.json must be Forbidden (403)
        const dataJsonRes = await request(server, { path: '/data.json' });
        assert.strictEqual(dataJsonRes.status, 403);

        // Hidden files like .gitignore must be Forbidden (403)
        const gitignoreRes = await request(server, { path: '/.gitignore' });
        assert.strictEqual(gitignoreRes.status, 403);

        // Path traversal attempts must be Forbidden (403)
        const traversalRes = await request(server, { path: '/../../etc/passwd' });
        assert.strictEqual(traversalRes.status, 403);
    } finally {
        server.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('Server — Invalid requests and error handling', async () => {
    const { tempDir, tempDb } = createTempEnv();
    const server = createServer({ dataFile: tempDb, publicDir: path.join(__dirname, '..') });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

    try {
        // POST /api/data with invalid JSON returns 400
        const badJsonRes = await request(server, {
            path: '/api/data',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, '{ bad json');

        assert.strictEqual(badJsonRes.status, 400);

        // DELETE /api/data returns 405 Method Not Allowed
        const deleteRes = await request(server, {
            path: '/api/data',
            method: 'DELETE'
        });
        assert.strictEqual(deleteRes.status, 405);

        // OPTIONS /api/data returns 204 No Content
        const optionsRes = await request(server, {
            path: '/api/data',
            method: 'OPTIONS'
        });
        assert.strictEqual(optionsRes.status, 204);
    } finally {
        server.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});
