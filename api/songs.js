/**
 * Vercel Serverless Function: GET /api/songs
 * Dynamically discovers songs in songs/ directory or serves generated manifest.
 */

const fs = require('fs');
const path = require('path');

const AUDIO_EXTS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.webm']);

function formatTitle(filename) {
    const base = filename.replace(/\.[^/.]+$/, '');
    const audioDateMatch = base.match(/^AUDIO[-_](\d{4})[-_](\d{2})[-_](\d{2})[-_](\d{2})[-_](\d{2})[-_](\d{2})(.*)$/i);
    if (audioDateMatch) {
        const [_, year, month, day, hour, min, sec, extra] = audioDateMatch;
        let suffix = extra.replace(/[-_]/g, ' ').trim();
        if (suffix) suffix = ` (${suffix})`;
        return `Track ${hour}:${min}:${sec}${suffix}`;
    }
    return base
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
        .trim();
}

module.exports = function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const possibleDirs = [
        path.join(process.cwd(), 'songs'),
        path.join(process.cwd(), 'songs '),
        path.join(__dirname, '../songs'),
        path.join(__dirname, '../../songs')
    ];

    let targetDir = null;
    for (const dir of possibleDirs) {
        if (fs.existsSync(dir)) {
            targetDir = dir;
            break;
        }
    }

    // Try reading manifest.json if exists
    if (targetDir) {
        const manifestPath = path.join(targetDir, 'manifest.json');
        if (fs.existsSync(manifestPath)) {
            try {
                const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                if (manifest && Array.isArray(manifest.songs) && manifest.songs.length > 0) {
                    res.status(200).json(manifest);
                    return;
                }
            } catch (e) {}
        }

        // Live filesystem fallback
        try {
            const files = fs.readdirSync(targetDir);
            const songs = [];
            let counter = 1;
            for (const file of files) {
                if (file.startsWith('.') || file.endsWith('.json') || file.endsWith('.md')) continue;
                const ext = path.extname(file).toLowerCase();
                if (!AUDIO_EXTS.has(ext)) continue;
                const fullPath = path.join(targetDir, file);
                const stat = fs.statSync(fullPath);
                if (!stat.isFile()) continue;

                songs.push({
                    id: `song-${counter++}`,
                    filename: file,
                    title: formatTitle(file),
                    url: `songs/${encodeURIComponent(file)}`,
                    size: stat.size,
                    ext: ext,
                    updatedAt: stat.mtime.toISOString()
                });
            }

            res.status(200).json({
                updatedAt: new Date().toISOString(),
                count: songs.length,
                songs: songs
            });
            return;
        } catch (e) {
            console.error('[Vercel API Songs] Error scanning songs:', e.message);
        }
    }

    res.status(200).json({
        updatedAt: new Date().toISOString(),
        count: 0,
        songs: []
    });
};
