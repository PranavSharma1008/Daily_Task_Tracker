/**
 * DayTask — Songs Manifest Generator
 * Scans the songs/ directory for audio files and generates a JSON manifest.
 * Used during build time for Vercel, GitHub deployments, and local sync.
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

function scanSongs(rootDir = path.resolve(__dirname, '..')) {
    const primaryDir = path.join(rootDir, 'songs');
    const legacyDir = path.join(rootDir, 'songs ');
    let targetDir = fs.existsSync(primaryDir) ? primaryDir : (fs.existsSync(legacyDir) ? legacyDir : null);

    if (!targetDir) {
        console.warn('[Songs Manifest] Warning: songs directory not found at', primaryDir);
        return [];
    }

    const files = fs.readdirSync(targetDir);
    const songs = [];
    let counter = 1;

    for (const file of files) {
        if (file.startsWith('.') || file.endsWith('.json') || file.endsWith('.md')) continue;
        const ext = path.extname(file).toLowerCase();
        if (!AUDIO_EXTS.has(ext)) continue;

        const fullPath = path.join(targetDir, file);
        try {
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
        } catch (e) {
            console.error(`[Songs Manifest] Could not stat ${file}:`, e.message);
        }
    }

    return songs;
}

function generateManifest(rootDir = path.resolve(__dirname, '..')) {
    const songs = scanSongs(rootDir);
    const manifest = {
        updatedAt: new Date().toISOString(),
        count: songs.length,
        songs: songs
    };

    const targetDir = path.join(rootDir, 'songs');
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    const manifestPath = path.join(targetDir, 'manifest.json');
    const songsJsonPath = path.join(targetDir, 'songs.json');

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    fs.writeFileSync(songsJsonPath, JSON.stringify(manifest, null, 2), 'utf8');

    console.log(`[Songs Manifest] Generated successfully with ${songs.length} audio track(s).`);
    return manifest;
}

if (require.main === module) {
    generateManifest();
}

module.exports = {
    formatTitle,
    scanSongs,
    generateManifest,
    AUDIO_EXTS
};
