const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { createServer, getSongsList, formatSongTitle } = require('../server.js');
const { scanSongs, generateManifest } = require('../scripts/generate-songs-manifest.js');
const vercelHandler = require('../api/songs.js');

function request(server, options) {
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
        req.end();
    });
}

test('Songs — formatSongTitle formats audio file names nicely', () => {
    assert.strictEqual(formatSongTitle('AUDIO-2026-10-14-16-49-21.mp3'), 'Track 16:49:21');
    assert.strictEqual(formatSongTitle('AUDIO-2026-10-14-16-49-37 copy.mp3'), 'Track 16:49:37 (copy)');
    assert.strictEqual(formatSongTitle('lofi-chill-beat.mp3'), 'Lofi Chill Beat');
    assert.strictEqual(formatSongTitle('study_music.mp3'), 'Study Music');
});

test('Songs — getSongsList discovers files from songs directory', () => {
    const songs = getSongsList(path.join(__dirname, '..'));
    assert.ok(Array.isArray(songs));
    assert.ok(songs.length >= 7, 'Should discover all audio files in songs folder');
    assert.strictEqual(songs[0].ext, '.mp3');
    assert.ok(songs[0].url.startsWith('songs/'));
});

test('Songs — Server GET /api/songs returns dynamic song list', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'daytask-songs-'));
    const tempDb = path.join(tempDir, 'data.json');
    const server = createServer({ dataFile: tempDb, publicDir: path.join(__dirname, '..') });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

    try {
        const res = await request(server, { path: '/api/songs' });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.headers['content-type'], 'application/json; charset=utf-8');
        assert.strictEqual(res.json.success, true);
        assert.ok(res.json.count >= 7);
        assert.ok(Array.isArray(res.json.songs));
        assert.ok(res.json.songs.length >= 7);
    } finally {
        server.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('Songs — Server serves audio files with audio/mpeg and Range 206 support', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'daytask-audio-'));
    const tempDb = path.join(tempDir, 'data.json');
    const server = createServer({ dataFile: tempDb, publicDir: path.join(__dirname, '..') });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

    try {
        // Standard full request
        const resFull = await request(server, { path: '/songs/AUDIO-2026-10-14-16-49-21.mp3' });
        assert.strictEqual(resFull.status, 200);
        assert.strictEqual(resFull.headers['content-type'], 'audio/mpeg');
        assert.strictEqual(resFull.headers['accept-ranges'], 'bytes');

        // Range request (HTTP 206 Partial Content)
        const resRange = await request(server, {
            path: '/songs/AUDIO-2026-10-14-16-49-21.mp3',
            headers: { 'Range': 'bytes=0-100' }
        });
        assert.strictEqual(resRange.status, 206);
        assert.strictEqual(resRange.headers['content-type'], 'audio/mpeg');
        assert.ok(resRange.headers['content-range'].startsWith('bytes 0-100/'));
        assert.strictEqual(resRange.headers['content-length'], '101');
    } finally {
        server.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('Songs — generateManifest builds valid songs/manifest.json', () => {
    const root = path.join(__dirname, '..');
    const manifest = generateManifest(root);
    assert.ok(manifest.count >= 7);
    assert.strictEqual(manifest.songs.length, manifest.count);
    assert.ok(fs.existsSync(path.join(root, 'songs', 'manifest.json')));
    assert.ok(fs.existsSync(path.join(root, 'songs', 'songs.json')));
});

test('Songs — Vercel serverless handler returns songs JSON', async () => {
    let statusCode = 0;
    let headers = {};
    let responseBody = null;

    const fakeReq = { method: 'GET' };
    const fakeRes = {
        setHeader: (k, v) => { headers[k] = v; },
        status: (code) => {
            statusCode = code;
            return {
                json: (data) => { responseBody = data; },
                end: () => {}
            };
        }
    };

    vercelHandler(fakeReq, fakeRes);
    assert.strictEqual(statusCode, 200);
    assert.ok(responseBody != null);
    assert.ok(responseBody.count >= 7);
    assert.ok(Array.isArray(responseBody.songs));
});

test('Songs — Fisher-Yates shuffle generates valid permutations and preserves elements', () => {
    const SongsPlayer = require('../js/songs-player.js');
    const length = 7;
    const shuffled = SongsPlayer.generateShuffledQueue(length);

    assert.strictEqual(shuffled.length, length);
    // All indices 0 to length-1 are present
    const sorted = [...shuffled].sort((a, b) => a - b);
    assert.deepStrictEqual(sorted, [0, 1, 2, 3, 4, 5, 6]);

    // Test preserveCurrentIndex floats to index 0
    const preserved = SongsPlayer.generateShuffledQueue(length, 4);
    assert.strictEqual(preserved[0], 4, 'Preserved index should be at position 0');
    assert.deepStrictEqual([...preserved].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6]);
});

test('Songs — formatTime and formatFileSize utility functions', () => {
    const SongsPlayer = require('../js/songs-player.js');
    assert.strictEqual(SongsPlayer.formatTime(0), '0:00');
    assert.strictEqual(SongsPlayer.formatTime(65), '1:05');
    assert.strictEqual(SongsPlayer.formatTime(125), '2:05');
    assert.strictEqual(SongsPlayer.formatTime(3600), '60:00');

    assert.strictEqual(SongsPlayer.formatFileSize(1024), '1.0 KB');
    assert.strictEqual(SongsPlayer.formatFileSize(1048576), '1.0 MB');
    assert.strictEqual(SongsPlayer.formatFileSize(457747), '447.0 KB');
});

