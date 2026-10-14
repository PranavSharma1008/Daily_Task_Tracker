/**
 * DayTask — Songs & Background Music Player
 * Handles dynamic song discovery, Fisher-Yates shuffled playlist,
 * persistent user preferences, HTML5 audio playback, and responsive UI.
 */

(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.SongsPlayer = factory();
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // Storage Keys
    const STORAGE_KEY_AUTOPLAY = 'daytask_songs_pref_autoplay';
    const STORAGE_KEY_SHUFFLE = 'daytask_songs_pref_shuffle';
    const STORAGE_KEY_VOLUME = 'daytask_songs_pref_volume';
    const STORAGE_KEY_MUTED = 'daytask_songs_pref_muted';
    const STORAGE_KEY_LOOP = 'daytask_songs_pref_loop';
    const STORAGE_KEY_LAST_ID = 'daytask_songs_pref_last_id';
    const STORAGE_KEY_LAST_TIME = 'daytask_songs_pref_last_time';
    const STORAGE_KEY_MINI = 'daytask_songs_pref_mini';

    // Fallback default tracks if offline or static without API
    const DEFAULT_SONGS = [
        { id: 'song-1', filename: 'AUDIO-2026-10-14-16-49-21.mp3', title: 'Track 16:49:21', url: 'songs/AUDIO-2026-10-14-16-49-21.mp3', size: 457747, ext: '.mp3' },
        { id: 'song-2', filename: 'AUDIO-2026-10-14-16-49-37 copy.mp3', title: 'Track 16:49:37 (copy)', url: 'songs/AUDIO-2026-10-14-16-49-37%20copy.mp3', size: 608216, ext: '.mp3' },
        { id: 'song-3', filename: 'AUDIO-2026-10-14-16-49-37.mp3', title: 'Track 16:49:37', url: 'songs/AUDIO-2026-10-14-16-49-37.mp3', size: 975260, ext: '.mp3' },
        { id: 'song-4', filename: 'AUDIO-2026-10-14-16-49-38.mp3', title: 'Track 16:49:38', url: 'songs/AUDIO-2026-10-14-16-49-38.mp3', size: 249080, ext: '.mp3' },
        { id: 'song-5', filename: 'AUDIO-2026-10-14-16-49-51.mp3', title: 'Track 16:49:51', url: 'songs/AUDIO-2026-10-14-16-49-51.mp3', size: 880804, ext: '.mp3' },
        { id: 'song-6', filename: 'AUDIO-2026-10-14-16-49-57.mp3', title: 'Track 16:49:57', url: 'songs/AUDIO-2026-10-14-16-49-57.mp3', size: 651626, ext: '.mp3' },
        { id: 'song-7', filename: 'AUDIO-2026-10-14-16-50-21.mp3', title: 'Track 16:50:21', url: 'songs/AUDIO-2026-10-14-16-50-21.mp3', size: 670372, ext: '.mp3' }
    ];

    // Player State
    let songsList = [...DEFAULT_SONGS];
    let shuffledIndices = [];
    let currentQueuePointer = 0; // index inside shuffledIndices
    let isPlaying = false;
    let isSeeking = false;
    let audio = null;
    let autoplayPendingGesture = false;

    // Preferences with defaults
    const preferences = {
        autoplay: false,
        shuffle: true,
        volume: 0.6,
        muted: false,
        loop: 'all', // 'all', 'one', 'none'
        lastSongId: null,
        lastTime: 0,
        showMini: true
    };

    // Load saved preferences from localStorage
    function loadPreferences() {
        if (typeof localStorage === 'undefined') return;
        try {
            const savedAutoplay = localStorage.getItem(STORAGE_KEY_AUTOPLAY);
            if (savedAutoplay !== null) preferences.autoplay = savedAutoplay === 'true';

            const savedShuffle = localStorage.getItem(STORAGE_KEY_SHUFFLE);
            if (savedShuffle !== null) preferences.shuffle = savedShuffle === 'true';

            const savedVol = localStorage.getItem(STORAGE_KEY_VOLUME);
            if (savedVol !== null) {
                const parsed = parseFloat(savedVol);
                if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) preferences.volume = parsed;
            }

            const savedMuted = localStorage.getItem(STORAGE_KEY_MUTED);
            if (savedMuted !== null) preferences.muted = savedMuted === 'true';

            const savedLoop = localStorage.getItem(STORAGE_KEY_LOOP);
            if (savedLoop && ['all', 'one', 'none'].includes(savedLoop)) preferences.loop = savedLoop;

            const savedLastId = localStorage.getItem(STORAGE_KEY_LAST_ID);
            if (savedLastId) preferences.lastSongId = savedLastId;

            const savedTime = localStorage.getItem(STORAGE_KEY_LAST_TIME);
            if (savedTime) {
                const pt = parseFloat(savedTime);
                if (!isNaN(pt) && pt >= 0) preferences.lastTime = pt;
            }

            const savedMini = localStorage.getItem(STORAGE_KEY_MINI);
            if (savedMini !== null) preferences.showMini = savedMini === 'true';
        } catch (e) {
            console.error('[SongsPlayer] Could not load preferences:', e.message);
        }
    }

    function savePreference(key, value) {
        if (typeof localStorage === 'undefined') return;
        try {
            localStorage.setItem(key, String(value));
        } catch (e) {}
    }

    // Fisher-Yates Shuffle Algorithm
    function generateShuffledQueue(length, preserveIndex = -1) {
        const indices = Array.from({ length }, (_, i) => i);
        if (length <= 1) return indices;

        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }

        // If a track is already playing, float it to index 0 so playback continues uninterrupted
        if (preserveIndex >= 0 && preserveIndex < length) {
            const foundPos = indices.indexOf(preserveIndex);
            if (foundPos > 0) {
                indices.splice(foundPos, 1);
                indices.unshift(preserveIndex);
            }
        }

        return indices;
    }

    // Build or update the playback queue
    function rebuildQueue(preserveCurrent = false) {
        if (!songsList || songsList.length === 0) {
            shuffledIndices = [];
            currentQueuePointer = 0;
            return;
        }

        let preserveActualIndex = -1;
        if (preserveCurrent && shuffledIndices.length > 0) {
            preserveActualIndex = shuffledIndices[currentQueuePointer] || 0;
        }

        if (preferences.shuffle) {
            shuffledIndices = generateShuffledQueue(songsList.length, preserveActualIndex);
            currentQueuePointer = 0;
        } else {
            shuffledIndices = Array.from({ length: songsList.length }, (_, i) => i);
            currentQueuePointer = preserveActualIndex >= 0 ? preserveActualIndex : 0;
        }
    }

    // Format seconds to mm:ss
    function formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    // Format bytes to readable size
    function formatFileSize(bytes) {
        if (!bytes || bytes <= 0) return '';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    // Get current song object
    function getCurrentSong() {
        if (!songsList || songsList.length === 0) return null;
        const actualIndex = shuffledIndices[currentQueuePointer];
        return songsList[actualIndex] || songsList[0];
    }

    // Audio Engine Initialization
    function initAudio() {
        if (audio) return audio;
        audio = new Audio();
        audio.preload = 'metadata';
        audio.volume = preferences.volume;
        audio.muted = preferences.muted;

        audio.addEventListener('play', () => {
            isPlaying = true;
            updatePlayPauseUI();
        });

        audio.addEventListener('pause', () => {
            isPlaying = false;
            updatePlayPauseUI();
        });

        audio.addEventListener('timeupdate', () => {
            if (!isSeeking) {
                updateProgressUI();
            }
            // Save resume position periodically (every 5 seconds)
            if (audio.currentTime > 2 && Math.floor(audio.currentTime) % 5 === 0) {
                const cur = getCurrentSong();
                if (cur) {
                    savePreference(STORAGE_KEY_LAST_ID, cur.id);
                    savePreference(STORAGE_KEY_LAST_TIME, Math.floor(audio.currentTime));
                }
            }
        });

        audio.addEventListener('loadedmetadata', () => {
            updateProgressUI();
        });

        audio.addEventListener('ended', () => {
            handleTrackEnded();
        });

        audio.addEventListener('error', (e) => {
            console.warn('[SongsPlayer] Audio error:', e);
            showToast('Audio playback error. Skipping to next song...');
            setTimeout(playNext, 1200);
        });

        return audio;
    }

    function handleTrackEnded() {
        if (preferences.loop === 'one') {
            audio.currentTime = 0;
            audio.play().catch(() => {});
            return;
        }

        const isLastInQueue = currentQueuePointer >= shuffledIndices.length - 1;
        if (isLastInQueue) {
            if (preferences.loop === 'all') {
                if (preferences.shuffle) {
                    // Reshuffle for next round
                    shuffledIndices = generateShuffledQueue(songsList.length);
                }
                currentQueuePointer = 0;
                loadAndPlayCurrent();
            } else {
                // Loop is 'none', stop at end
                isPlaying = false;
                updatePlayPauseUI();
            }
        } else {
            currentQueuePointer++;
            loadAndPlayCurrent();
        }
    }

    // Play/Pause and navigation methods
    function loadAndPlayCurrent(startTime = 0) {
        initAudio();
        const song = getCurrentSong();
        if (!song) return;

        audio.src = song.url;
        if (startTime > 0) {
            audio.currentTime = startTime;
        }

        savePreference(STORAGE_KEY_LAST_ID, song.id);

        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                isPlaying = true;
                updateUI();
            }).catch((err) => {
                isPlaying = false;
                updatePlayPauseUI();
                if (err.name === 'NotAllowedError') {
                    // Autoplay was blocked by browser gesture requirement
                    armAutoplayGesture();
                } else {
                    console.warn('[SongsPlayer] Play error:', err.message);
                }
            });
        }
    }

    function play() {
        initAudio();
        const song = getCurrentSong();
        if (!song) return;

        if (!audio.src || !audio.src.includes(song.url)) {
            loadAndPlayCurrent();
            return;
        }

        audio.play().then(() => {
            isPlaying = true;
            updatePlayPauseUI();
        }).catch((err) => {
            if (err.name === 'NotAllowedError') armAutoplayGesture();
        });
    }

    function pause() {
        if (audio) {
            audio.pause();
            isPlaying = false;
            updatePlayPauseUI();
        }
    }

    function togglePlay() {
        if (isPlaying) {
            pause();
        } else {
            play();
        }
    }

    function playNext() {
        if (!songsList.length) return;
        if (currentQueuePointer >= shuffledIndices.length - 1) {
            if (preferences.loop === 'all') {
                if (preferences.shuffle) {
                    shuffledIndices = generateShuffledQueue(songsList.length);
                }
                currentQueuePointer = 0;
            } else {
                return;
            }
        } else {
            currentQueuePointer++;
        }
        loadAndPlayCurrent();
        showTrackToast();
    }

    function playPrevious() {
        if (!songsList.length) return;
        // If > 3 seconds in, restart track
        if (audio && audio.currentTime > 3) {
            audio.currentTime = 0;
            return;
        }
        if (currentQueuePointer <= 0) {
            currentQueuePointer = shuffledIndices.length - 1;
        } else {
            currentQueuePointer--;
        }
        loadAndPlayCurrent();
        showTrackToast();
    }

    function playSongByIndex(actualIndex) {
        if (actualIndex < 0 || actualIndex >= songsList.length) return;
        let queuePos = shuffledIndices.indexOf(actualIndex);
        if (queuePos === -1) {
            shuffledIndices.push(actualIndex);
            queuePos = shuffledIndices.length - 1;
        }
        currentQueuePointer = queuePos;
        loadAndPlayCurrent();
        showTrackToast();
    }

    function seekTo(percent) {
        if (!audio || !audio.duration) return;
        const targetTime = (percent / 100) * audio.duration;
        audio.currentTime = targetTime;
    }

    function setVolume(vol) {
        const clamped = Math.max(0, Math.min(1, vol));
        preferences.volume = clamped;
        savePreference(STORAGE_KEY_VOLUME, clamped);
        if (audio) audio.volume = clamped;
        updateVolumeUI();
    }

    function toggleMute() {
        preferences.muted = !preferences.muted;
        savePreference(STORAGE_KEY_MUTED, preferences.muted);
        if (audio) audio.muted = preferences.muted;
        updateVolumeUI();
    }

    function toggleShuffle() {
        preferences.shuffle = !preferences.shuffle;
        savePreference(STORAGE_KEY_SHUFFLE, preferences.shuffle);
        rebuildQueue(true);
        updateUI();
        showToast(preferences.shuffle ? '🔀 Shuffle Mode Enabled' : '➡️ Sequential Mode Enabled');
    }

    function reshuffleQueue() {
        if (!preferences.shuffle) {
            preferences.shuffle = true;
            savePreference(STORAGE_KEY_SHUFFLE, true);
        }
        const curActual = shuffledIndices[currentQueuePointer] || 0;
        shuffledIndices = generateShuffledQueue(songsList.length, curActual);
        currentQueuePointer = 0;
        updateUI();
        showToast('🎲 Playlist Re-shuffled!');
    }

    function setLoopMode(mode) {
        if (!['all', 'one', 'none'].includes(mode)) return;
        preferences.loop = mode;
        savePreference(STORAGE_KEY_LOOP, mode);
        updateLoopUI();
    }

    function toggleAutoplayPreference(enabled) {
        preferences.autoplay = !!enabled;
        savePreference(STORAGE_KEY_AUTOPLAY, preferences.autoplay);
        updatePreferenceUI();
        showToast(preferences.autoplay ? '⚡ Auto-play on visit enabled' : '⏸ Auto-play on visit disabled');
    }

    // Autoplay browser user-gesture listener
    function armAutoplayGesture() {
        if (autoplayPendingGesture) return;
        autoplayPendingGesture = true;

        const startAutoplayOnGesture = () => {
            autoplayPendingGesture = false;
            window.removeEventListener('click', startAutoplayOnGesture, true);
            window.removeEventListener('keydown', startAutoplayOnGesture, true);
            window.removeEventListener('touchstart', startAutoplayOnGesture, true);

            if (preferences.autoplay && !isPlaying) {
                play();
            }
        };

        window.addEventListener('click', startAutoplayOnGesture, true);
        window.addEventListener('keydown', startAutoplayOnGesture, true);
        window.addEventListener('touchstart', startAutoplayOnGesture, true);
    }

    // Fetch songs dynamically from API with fallback to static manifest
    async function fetchSongsList() {
        const timestamp = Date.now();
        // 1. Try dynamic API endpoint (works on Node server and Vercel serverless /api/songs)
        try {
            const apiRes = await fetch(`/api/songs?_t=${timestamp}`, { cache: 'no-store' });
            if (apiRes.ok) {
                const data = await apiRes.json();
                if (data && Array.isArray(data.songs) && data.songs.length > 0) {
                    songsList = data.songs;
                    rebuildQueue(true);
                    updateUI();
                    return songsList;
                }
            }
        } catch (e) {
            // API not available or static hosting
        }

        // 2. Try static songs/manifest.json (works on pure static Vercel/GitHub Pages)
        try {
            const staticRes = await fetch(`songs/manifest.json?_t=${timestamp}`, { cache: 'no-store' });
            if (staticRes.ok) {
                const data = await staticRes.json();
                if (data && Array.isArray(data.songs) && data.songs.length > 0) {
                    songsList = data.songs;
                    rebuildQueue(true);
                    updateUI();
                    return songsList;
                }
            }
        } catch (e) {
            // Fallback to static songs.json
        }

        try {
            const staticRes2 = await fetch(`songs/songs.json?_t=${timestamp}`, { cache: 'no-store' });
            if (staticRes2.ok) {
                const data = await staticRes2.json();
                if (data && Array.isArray(data.songs) && data.songs.length > 0) {
                    songsList = data.songs;
                    rebuildQueue(true);
                    updateUI();
                    return songsList;
                }
            }
        } catch (e) {}

        // Fallback to baked-in default list
        songsList = [...DEFAULT_SONGS];
        rebuildQueue(true);
        updateUI();
        return songsList;
    }

    // ==========================================
    // UI UPDATES & DOM MANIPULATION
    // ==========================================
    let dom = {};

    function cacheDomElements() {
        dom = {
            // Top Header Button
            btnMusicToggle: document.getElementById('btn-music'),
            headerMusicBars: document.getElementById('header-music-bars'),
            headerMusicStatus: document.getElementById('header-music-status'),

            // Songs Modal
            songsModal: document.getElementById('songs-modal'),
            btnCloseSongsModal: document.getElementById('btn-close-songs-modal'),
            songsCountBadge: document.getElementById('songs-count-badge'),
            songsModalTabBtns: document.querySelectorAll('.songs-tab-btn'),
            songsTabContents: document.querySelectorAll('.songs-tab-pane'),

            // Hero Card (Now Playing)
            heroDisc: document.getElementById('songs-hero-disc'),
            heroTrackTitle: document.getElementById('songs-hero-title'),
            heroTrackSub: document.getElementById('songs-hero-subtitle'),
            heroTimeCurrent: document.getElementById('songs-time-current'),
            heroTimeTotal: document.getElementById('songs-time-total'),
            heroProgressBar: document.getElementById('songs-progress-bar'),

            // Controls
            btnHeroShuffle: document.getElementById('btn-songs-shuffle'),
            btnHeroPrev: document.getElementById('btn-songs-prev'),
            btnHeroPlay: document.getElementById('btn-songs-play'),
            btnHeroNext: document.getElementById('btn-songs-next'),
            btnHeroLoop: document.getElementById('btn-songs-loop'),
            btnHeroMute: document.getElementById('btn-songs-mute'),
            heroVolumeSlider: document.getElementById('songs-volume-slider'),
            heroVolumeValue: document.getElementById('songs-volume-value'),

            // Playlist Tab
            playlistContainer: document.getElementById('songs-playlist-items'),
            playlistSearchInput: document.getElementById('songs-search-input'),
            btnReshuffle: document.getElementById('btn-songs-reshuffle'),
            btnRefreshSongs: document.getElementById('btn-songs-refresh'),

            // Preferences Tab
            chkAutoplay: document.getElementById('pref-songs-autoplay'),
            chkShuffle: document.getElementById('pref-songs-shuffle'),
            selLoop: document.getElementById('pref-songs-loop'),

            // Floating Mini Player
            miniPlayerBar: document.getElementById('floating-music-bar'),
            miniDisc: document.getElementById('mini-player-disc'),
            miniTrackTitle: document.getElementById('mini-track-title'),
            miniTrackSub: document.getElementById('mini-track-sub'),
            btnMiniShuffle: document.getElementById('btn-mini-shuffle'),
            btnMiniPrev: document.getElementById('btn-mini-prev'),
            btnMiniPlay: document.getElementById('btn-mini-play'),
            btnMiniNext: document.getElementById('btn-mini-next'),
            btnMiniVolume: document.getElementById('btn-mini-volume'),
            miniVolumeSlider: document.getElementById('mini-volume-slider'),
            btnMiniExpand: document.getElementById('btn-mini-expand'),
            btnMiniClose: document.getElementById('btn-mini-close'),
            btnOpenSongsFromMini: document.getElementById('btn-open-songs-from-mini')
        };
    }

    function updatePlayPauseUI() {
        if (!dom.btnHeroPlay) return;

        // Header wave bars
        if (dom.headerMusicBars) {
            dom.headerMusicBars.classList.toggle('hidden', !isPlaying);
        }
        if (dom.btnMusicToggle) {
            dom.btnMusicToggle.classList.toggle('playing', isPlaying);
        }

        // Hero Play Button icon
        const playIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>`;
        const pauseIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;

        dom.btnHeroPlay.innerHTML = isPlaying ? pauseIcon : playIcon;
        dom.btnHeroPlay.title = isPlaying ? 'Pause (P)' : 'Play (P)';
        dom.btnHeroPlay.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');

        // Hero Disc spinning animation
        if (dom.heroDisc) {
            dom.heroDisc.classList.toggle('spinning', isPlaying);
        }

        // Mini player
        if (dom.btnMiniPlay) {
            const miniPlayIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>`;
            const miniPauseIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
            dom.btnMiniPlay.innerHTML = isPlaying ? miniPauseIcon : miniPlayIcon;
        }

        if (dom.miniDisc) {
            dom.miniDisc.classList.toggle('spinning', isPlaying);
        }

        // Show mini player if playing and user preference allows
        if (dom.miniPlayerBar && preferences.showMini) {
            dom.miniPlayerBar.classList.remove('hidden');
        }

        // Update active class on playlist items
        updatePlaylistActiveItem();
    }

    function updateProgressUI() {
        if (!audio || !dom.heroProgressBar) return;
        const cur = audio.currentTime || 0;
        const dur = audio.duration || 0;

        if (dom.heroTimeCurrent) dom.heroTimeCurrent.textContent = formatTime(cur);
        if (dom.heroTimeTotal) dom.heroTimeTotal.textContent = dur > 0 ? formatTime(dur) : '--:--';

        const percent = dur > 0 ? (cur / dur) * 100 : 0;
        dom.heroProgressBar.value = Math.min(100, Math.max(0, percent));
        dom.heroProgressBar.style.setProperty('--progress-pct', `${percent}%`);
    }

    function updateVolumeUI() {
        const volPercent = Math.round(preferences.volume * 100);
        const isMuted = preferences.muted || preferences.volume === 0;

        if (dom.heroVolumeSlider) dom.heroVolumeSlider.value = isMuted ? 0 : volPercent;
        if (dom.miniVolumeSlider) dom.miniVolumeSlider.value = isMuted ? 0 : volPercent;
        if (dom.heroVolumeValue) dom.heroVolumeValue.textContent = isMuted ? 'Muted' : `${volPercent}%`;

        const muteIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;
        const volIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;

        if (dom.btnHeroMute) dom.btnHeroMute.innerHTML = isMuted ? muteIcon : volIcon;
        if (dom.btnMiniVolume) dom.btnMiniVolume.innerHTML = isMuted ? muteIcon : volIcon;
    }

    function updateLoopUI() {
        if (!dom.btnHeroLoop) return;
        const mode = preferences.loop;
        let title = 'Loop Playlist';
        let badge = 'All';

        if (mode === 'one') {
            title = 'Loop Single Track (Click to change)';
            badge = '1';
            dom.btnHeroLoop.classList.add('active');
        } else if (mode === 'none') {
            title = 'No Repeat (Click to change)';
            badge = 'Off';
            dom.btnHeroLoop.classList.remove('active');
        } else {
            title = 'Repeat All (Click to change)';
            badge = 'All';
            dom.btnHeroLoop.classList.add('active');
        }

        dom.btnHeroLoop.title = title;
        dom.btnHeroLoop.innerHTML = `<span class="loop-icon">🔁</span><span class="loop-badge">${badge}</span>`;
        if (dom.selLoop) dom.selLoop.value = mode;
    }

    function updatePreferenceUI() {
        if (dom.chkAutoplay) dom.chkAutoplay.checked = preferences.autoplay;
        if (dom.chkShuffle) dom.chkShuffle.checked = preferences.shuffle;
        if (dom.selLoop) dom.selLoop.value = preferences.loop;
    }

    function updateTrackInfoUI() {
        const song = getCurrentSong();
        if (!song) return;

        const actualIndex = shuffledIndices[currentQueuePointer];
        const queuePos = currentQueuePointer + 1;
        const total = songsList.length;

        // Hero card
        if (dom.heroTrackTitle) dom.heroTrackTitle.textContent = song.title;
        if (dom.heroTrackSub) {
            dom.heroTrackSub.textContent = `Queue #${queuePos} of ${total} ${preferences.shuffle ? '· Shuffled' : '· Sequential'}`;
        }

        // Header button status
        if (dom.headerMusicStatus) {
            dom.headerMusicStatus.textContent = preferences.shuffle ? '🔀 Shuffled' : '▶ Next';
        }

        // Mini player
        if (dom.miniTrackTitle) dom.miniTrackTitle.textContent = song.title;
        if (dom.miniTrackSub) {
            dom.miniTrackSub.textContent = `${queuePos}/${total} ${preferences.shuffle ? '(Shuffled)' : ''}`;
        }

        // Shuffle button active state
        if (dom.btnHeroShuffle) dom.btnHeroShuffle.classList.toggle('active', preferences.shuffle);
        if (dom.btnMiniShuffle) dom.btnMiniShuffle.classList.toggle('active', preferences.shuffle);

        // Update count badge
        if (dom.songsCountBadge) dom.songsCountBadge.textContent = total;
    }

    function updatePlaylistActiveItem() {
        if (!dom.playlistContainer) return;
        const curSong = getCurrentSong();
        const items = dom.playlistContainer.querySelectorAll('.songs-playlist-item');
        items.forEach((item) => {
            const id = item.getAttribute('data-song-id');
            const isActive = curSong && id === curSong.id;
            item.classList.toggle('active', isActive);
            item.classList.toggle('is-playing', isActive && isPlaying);

            const playBtn = item.querySelector('.btn-item-play');
            if (playBtn) {
                playBtn.innerHTML = isActive && isPlaying
                    ? `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
                    : `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>`;
            }
        });
    }

    function renderPlaylist(filterQuery = '') {
        if (!dom.playlistContainer) return;
        const q = filterQuery.toLowerCase().trim();
        const filtered = songsList.filter(s => !q || s.title.toLowerCase().includes(q) || s.filename.toLowerCase().includes(q));

        if (filtered.length === 0) {
            dom.playlistContainer.innerHTML = `
                <div class="songs-empty-playlist">
                    <p>🔍 No songs matching "<strong>${escapeHTML(filterQuery)}</strong>"</p>
                </div>
            `;
            return;
        }

        const curSong = getCurrentSong();

        dom.playlistContainer.innerHTML = filtered.map((song, i) => {
            const actualIndex = songsList.findIndex(s => s.id === song.id);
            const isActive = curSong && curSong.id === song.id;
            const isItemPlaying = isActive && isPlaying;
            const fileSize = formatFileSize(song.size);

            return `
                <div class="songs-playlist-item ${isActive ? 'active' : ''} ${isItemPlaying ? 'is-playing' : ''}" data-song-id="${song.id}" data-song-index="${actualIndex}">
                    <div class="item-left">
                        <button type="button" class="btn-item-play" title="Play ${escapeHTML(song.title)}" aria-label="Play ${escapeHTML(song.title)}">
                            ${isItemPlaying
                                ? `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
                                : `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>`
                            }
                        </button>
                        <div class="item-text">
                            <span class="item-title">${escapeHTML(song.title)}</span>
                            <span class="item-filename">${escapeHTML(song.filename)} ${fileSize ? `&bull; ${fileSize}` : ''}</span>
                        </div>
                    </div>
                    <div class="item-right">
                        ${isActive ? `
                            <span class="item-active-wave">
                                <span></span><span></span><span></span>
                            </span>
                        ` : ''}
                        <span class="item-number">#${actualIndex + 1}</span>
                    </div>
                </div>
            `;
        }).join('');

        // Attach click listener to each item
        const items = dom.playlistContainer.querySelectorAll('.songs-playlist-item');
        items.forEach(el => {
            el.addEventListener('click', (e) => {
                const idx = parseInt(el.getAttribute('data-song-index'), 10);
                if (!isNaN(idx)) {
                    if (curSong && curSong.id === el.getAttribute('data-song-id') && isPlaying) {
                        pause();
                    } else {
                        playSongByIndex(idx);
                    }
                }
            });
        });
    }

    function updateUI() {
        updateTrackInfoUI();
        updatePlayPauseUI();
        updateProgressUI();
        updateVolumeUI();
        updateLoopUI();
        updatePreferenceUI();
        renderPlaylist(dom.playlistSearchInput ? dom.playlistSearchInput.value : '');
    }

    function showToast(message) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = 'toast-message';
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }

    function showTrackToast() {
        const song = getCurrentSong();
        if (song) {
            showToast(`🎵 Playing: ${song.title} (${preferences.shuffle ? 'Shuffled' : 'Sequential'})`);
        }
    }

    function escapeHTML(str) {
        if (!str) return '';
        return String(str).replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

    // Modal Control
    function openModal(defaultTab = 'now-playing') {
        if (!dom.songsModal) return;
        dom.songsModal.classList.remove('hidden');
        switchModalTab(defaultTab);
        updateUI();
    }

    function closeModal() {
        if (!dom.songsModal) return;
        dom.songsModal.classList.add('hidden');
    }

    function switchModalTab(tabId) {
        if (!dom.songsModalTabBtns || !dom.songsTabContents) return;
        dom.songsModalTabBtns.forEach(btn => {
            const isTarget = btn.getAttribute('data-tab') === tabId;
            btn.classList.toggle('active', isTarget);
            btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
        });
        dom.songsTabContents.forEach(pane => {
            const isTarget = pane.getAttribute('id') === `tab-pane-${tabId}`;
            pane.classList.toggle('active', isTarget);
            pane.classList.toggle('hidden', !isTarget);
        });
    }

    // ==========================================
    // BIND EVENT LISTENERS
    // ==========================================
    function bindEvents() {
        // Top Header Button -> Open Modal
        if (dom.btnMusicToggle) {
            dom.btnMusicToggle.addEventListener('click', () => {
                openModal('now-playing');
            });
        }

        // Close Modal
        if (dom.btnCloseSongsModal) {
            dom.btnCloseSongsModal.addEventListener('click', closeModal);
        }

        // Modal backdrop click
        if (dom.songsModal) {
            dom.songsModal.addEventListener('click', (e) => {
                if (e.target === dom.songsModal) closeModal();
            });
        }

        // Modal Tab Buttons
        if (dom.songsModalTabBtns) {
            dom.songsModalTabBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const tabId = btn.getAttribute('data-tab');
                    switchModalTab(tabId);
                });
            });
        }

        // Hero Controls
        if (dom.btnHeroPlay) dom.btnHeroPlay.addEventListener('click', togglePlay);
        if (dom.btnHeroNext) dom.btnHeroNext.addEventListener('click', playNext);
        if (dom.btnHeroPrev) dom.btnHeroPrev.addEventListener('click', playPrevious);
        if (dom.btnHeroShuffle) dom.btnHeroShuffle.addEventListener('click', toggleShuffle);
        if (dom.btnHeroLoop) {
            dom.btnHeroLoop.addEventListener('click', () => {
                const modes = ['all', 'one', 'none'];
                const nextMode = modes[(modes.indexOf(preferences.loop) + 1) % modes.length];
                setLoopMode(nextMode);
                showToast(`🔁 Loop mode: ${nextMode.toUpperCase()}`);
            });
        }
        if (dom.btnHeroMute) dom.btnHeroMute.addEventListener('click', toggleMute);

        // Progress Bar Seeking
        if (dom.heroProgressBar) {
            dom.heroProgressBar.addEventListener('input', (e) => {
                isSeeking = true;
                const pct = parseFloat(e.target.value);
                if (audio && audio.duration) {
                    const previewTime = (pct / 100) * audio.duration;
                    if (dom.heroTimeCurrent) dom.heroTimeCurrent.textContent = formatTime(previewTime);
                }
            });

            dom.heroProgressBar.addEventListener('change', (e) => {
                isSeeking = false;
                seekTo(parseFloat(e.target.value));
            });
        }

        // Volume Slider
        if (dom.heroVolumeSlider) {
            dom.heroVolumeSlider.addEventListener('input', (e) => {
                setVolume(parseFloat(e.target.value) / 100);
            });
        }

        // Playlist Search
        if (dom.playlistSearchInput) {
            dom.playlistSearchInput.addEventListener('input', (e) => {
                renderPlaylist(e.target.value);
            });
        }

        // Reshuffle Button
        if (dom.btnReshuffle) {
            dom.btnReshuffle.addEventListener('click', reshuffleQueue);
        }

        // Refresh Songs from Server
        if (dom.btnRefreshSongs) {
            dom.btnRefreshSongs.addEventListener('click', async () => {
                dom.btnRefreshSongs.classList.add('rotating');
                await fetchSongsList();
                dom.btnRefreshSongs.classList.remove('rotating');
                showToast(`✓ Checked songs: ${songsList.length} track(s) discovered`);
            });
        }

        // Preferences inputs
        if (dom.chkAutoplay) {
            dom.chkAutoplay.addEventListener('change', (e) => {
                toggleAutoplayPreference(e.target.checked);
            });
        }

        if (dom.chkShuffle) {
            dom.chkShuffle.addEventListener('change', (e) => {
                if (preferences.shuffle !== e.target.checked) toggleShuffle();
            });
        }

        if (dom.selLoop) {
            dom.selLoop.addEventListener('change', (e) => {
                setLoopMode(e.target.value);
            });
        }

        // Floating Mini Player Controls
        if (dom.btnMiniPlay) dom.btnMiniPlay.addEventListener('click', togglePlay);
        if (dom.btnMiniNext) dom.btnMiniNext.addEventListener('click', playNext);
        if (dom.btnMiniPrev) dom.btnMiniPrev.addEventListener('click', playPrevious);
        if (dom.btnMiniShuffle) dom.btnMiniShuffle.addEventListener('click', toggleShuffle);
        if (dom.btnMiniVolume) dom.btnMiniVolume.addEventListener('click', toggleMute);
        if (dom.miniVolumeSlider) {
            dom.miniVolumeSlider.addEventListener('input', (e) => {
                setVolume(parseFloat(e.target.value) / 100);
            });
        }
        if (dom.btnMiniExpand || dom.btnOpenSongsFromMini) {
            const openFromMini = () => openModal('now-playing');
            if (dom.btnMiniExpand) dom.btnMiniExpand.addEventListener('click', openFromMini);
            if (dom.btnOpenSongsFromMini) dom.btnOpenSongsFromMini.addEventListener('click', openFromMini);
        }
        if (dom.btnMiniClose) {
            dom.btnMiniClose.addEventListener('click', () => {
                if (dom.miniPlayerBar) dom.miniPlayerBar.classList.add('hidden');
                preferences.showMini = false;
                savePreference(STORAGE_KEY_MINI, false);
            });
        }

        // Global Keyboard Shortcuts
        window.addEventListener('keydown', (e) => {
            const active = document.activeElement;
            const isTyping = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable || active.tagName === 'SELECT');

            if (isTyping) return;

            // 'P' -> Play / Pause
            if (e.key === 'p' || e.key === 'P') {
                if (!e.metaKey && !e.ctrlKey) {
                    e.preventDefault();
                    togglePlay();
                }
            }
            // '[' -> Previous Track
            else if (e.key === '[') {
                e.preventDefault();
                playPrevious();
            }
            // ']' -> Next Track
            else if (e.key === ']') {
                e.preventDefault();
                playNext();
            }
            // 'Escape' -> Close songs modal
            else if (e.key === 'Escape') {
                if (dom.songsModal && !dom.songsModal.classList.contains('hidden')) {
                    closeModal();
                }
            }
        });
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================
    async function init() {
        loadPreferences();
        cacheDomElements();
        bindEvents();
        rebuildQueue();

        // Check if last song was saved
        if (preferences.lastSongId) {
            const foundIndex = songsList.findIndex(s => s.id === preferences.lastSongId);
            if (foundIndex >= 0) {
                const qPos = shuffledIndices.indexOf(foundIndex);
                if (qPos >= 0) currentQueuePointer = qPos;
            }
        }

        updateUI();

        // Asynchronously scan for fresh songs from server or manifest
        fetchSongsList().then(() => {
            // Autoplay if user has autoplay enabled
            if (preferences.autoplay) {
                const song = getCurrentSong();
                if (song) {
                    initAudio();
                    audio.src = song.url;
                    audio.play().then(() => {
                        isPlaying = true;
                        updatePlayPauseUI();
                    }).catch(() => {
                        armAutoplayGesture();
                    });
                }
            }
        });
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
    }

    return {
        init,
        fetchSongsList,
        play,
        pause,
        togglePlay,
        playNext,
        playPrevious,
        playSongByIndex,
        setVolume,
        toggleMute,
        toggleShuffle,
        reshuffleQueue,
        setLoopMode,
        toggleAutoplayPreference,
        getCurrentSong,
        getSongsList: () => [...songsList],
        getShuffledIndices: () => [...shuffledIndices],
        generateShuffledQueue,
        formatTime,
        formatFileSize,
        preferences,
        openModal,
        closeModal
    };
});
