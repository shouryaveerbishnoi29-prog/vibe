const express = require('express');
const cors = require('cors');
const path = require('path');
const yts = require('yt-search');
const axios = require('axios');
const ytdl = require('@distube/ytdl-core');
const { createClient } = require('@libsql/client');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Turso Cloud SQLite DB
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || "libsql://vibe-shouryaveerbishnoi29-prog.aws-ap-south-1.turso.io",
  authToken: process.env.TURSO_AUTH_TOKEN || "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzI4Nzc3MzgsImlkIjoiMDE5Y2M3YmYtMzcwMS03YzE0LTk3MDQtZmVjODhlYzAwYmViIiwicmlkIjoiZjM4NzcxYjUtNzM5ZC00MjQ5LWI4OTQtMjI0NGUzNGNlNDllIn0.HarQCCyM9jpMzET2D4mcZGAoSkHcH6XMkin0CvZ3Zc7w8GzuRrtOVqK7NF1DK0fswQz3WUNcbcCT7kW_3XmvCw"
});

async function initDb() {
    try {
        await db.executeMultiple(`
            CREATE TABLE IF NOT EXISTS liked_songs (
                id TEXT PRIMARY KEY,
                title TEXT,
                subtitle TEXT,
                image TEXT,
                downloadUrl TEXT
            );
            
            CREATE TABLE IF NOT EXISTS playlists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT
            );

            CREATE TABLE IF NOT EXISTS playlist_songs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                playlist_id INTEGER,
                song_id TEXT,
                title TEXT,
                subtitle TEXT,
                image TEXT,
                downloadUrl TEXT,
                FOREIGN KEY(playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS search_history (
                term TEXT PRIMARY KEY,
                count INTEGER DEFAULT 1,
                last_searched DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS listen_history (
                song_id TEXT PRIMARY KEY,
                title TEXT,
                subtitle TEXT,
                image TEXT,
                downloadUrl TEXT,
                count INTEGER DEFAULT 1,
                last_played DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Turso Cloud DB successfully initialized!");
    } catch (error) {
        console.error("Failed to initialize DB:", error);
    }
}
initDb();

// In-memory cache to make the app lightning fast by avoiding redundant YT API calls
const searchCache = new Map();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

async function cachedYts(query) {
    const cacheKey = JSON.stringify(query);
    if (searchCache.has(cacheKey)) {
        const entry = searchCache.get(cacheKey);
        if (Date.now() - entry.timestamp < CACHE_TTL) {
            return entry.data;
        }
    }
    const results = await yts(query);
    searchCache.set(cacheKey, { data: results, timestamp: Date.now() });
    
    // Cleanup old cache entries if it gets too big
    if (searchCache.size > 200) {
        const firstKey = searchCache.keys().next().value;
        searchCache.delete(firstKey);
    }
    
    return results;
}

// Map a YouTube video object to our standard formatting
const SAAVN_BASE = 'https://jiosaavn-api-privatecvc2.vercel.app';
const mapYtSong = (v) => {
    const title = v.title || '';
    const author = (typeof v.author === 'string' ? v.author : v.author?.name) || 'Unknown Artist';
    return {
        id: v.videoId,
        title: title,
        subtitle: author,
        image: [{ quality: '500x500', url: v.image || v.thumbnail }],
        downloadUrl: [{ quality: '320kbps', url: `/api/stream/${v.videoId}?t=${encodeURIComponent(title)}&a=${encodeURIComponent(author)}` }],
        _rawTitle: title.toLowerCase()
    };
};

app.get('/api/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.status(400).json({ success: false, message: 'Query string required' });

        let results = [];
        const youtubeUrlRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
        const match = q.match(youtubeUrlRegex);

        if (match && match[1]) {
            const videoId = match[1];
            const ytInfo = await cachedYts({ videoId });
            if (ytInfo) results = [ytInfo];
        } else {
            const ytResults = await cachedYts(q);
            results = ytResults.videos || [];
        }
        
        try {
            await db.execute({
                sql: `
                INSERT INTO search_history (term, count, last_searched) 
                VALUES (?, 1, CURRENT_TIMESTAMP)
                ON CONFLICT(term) DO UPDATE SET count = count + 1, last_searched = CURRENT_TIMESTAMP
                `,
                args: [q.toLowerCase()]
            });
        } catch (err) { console.error("History logging error:", err.message); }

        let formattedResults = results.map(mapYtSong);

        // Advanced Sorting for higher accuracy
        const qLower = q.toLowerCase().trim();
        formattedResults = formattedResults.sort((a, b) => {
            const aTitle = a.title.toLowerCase();
            const bTitle = b.title.toLowerCase();

            // 1. Exact or Very Close Matches (highest priority)
            const aExact = aTitle.includes(qLower);
            const bExact = bTitle.includes(qLower);
            if (aExact && !bExact) return -1;
            if (bExact && !aExact) return 1;

            // 2. Penalty Words (covers, remixes etc) unless explicitly searched for
            const penaltyWords = ['cover', 'lofi', 'reverb', 'slowed', 'remix', 'instrumental', 'unplugged', 'reprise', 'mashup', '8d', 'karaoke', 'lyric'];
            const activePenaltyWords = penaltyWords.filter(w => !qLower.includes(w));
            
            let aPenalty = activePenaltyWords.some(w => aTitle.includes(w)) ? 1 : 0;
            let bPenalty = activePenaltyWords.some(w => bTitle.includes(w)) ? 1 : 0;
            if (aPenalty !== bPenalty) return aPenalty - bPenalty;

            return aTitle.length - bTitle.length;
        });

        res.json({ success: true, data: { results: formattedResults.slice(0, 30) } });
    } catch (e) {
        console.error("Search Error:", e.stack);
        res.status(500).json({ success: false, error: 'Search failed' });
    }
});

app.get('/api/stream/:id', async (req, res) => {
    try {
        const id = req.params.id;
        let title = req.query.t || '';
        let author = req.query.a || '';

        if (!title) {
            const ytInfo = await cachedYts({ videoId: id });
            if (ytInfo) {
                title = ytInfo.title;
                author = ytInfo.author?.name || '';
            }
        }

        // 1. Clean the title for better mapping
        const clean = (str) => {
            return str.split('|')[0]
                .split('-')[0]
                .replace(/[(\[].*?[)\]]/g, '')
                .replace(/official video/i, '')
                .replace(/music video/i, '')
                .replace(/lyrical/i, '')
                .replace(/audio only/i, '')
                .replace(/full song/i, '')
                .replace(/video/i, '')
                .trim();
        };

        const cleanTitle = clean(title);
        const cleanAuthor = author.replace(/vevo/i, '').replace(/official/i, '').trim();

        // 2. Try multiple search combinations on Saavn for maximum compatibility
        const searchCombinations = [
            `${cleanTitle} ${cleanAuthor}`,
            cleanTitle
        ];

        for (const query of searchCombinations) {
            try {
                const result = await axios.get(`${SAAVN_BASE}/search/songs`, { 
                    params: { query: query, limit: 1 },
                    timeout: 3000 
                });
                const songs = result.data?.data?.results || [];
                if (songs.length > 0) {
                    const dl = songs[0].downloadUrl.find(u => u.quality === '320kbps') || songs[0].downloadUrl[0];
                    if (dl && dl.link) {
                        return res.redirect(dl.link);
                    }
                }
            } catch (err) {
                console.error(`Saavn attempt failed for ${query}:`, err.message);
            }
        }

        // 3. Last Resort Fallback (Mapping to a universal audio source if both fail)
        // For now, we'll try one last 'ultra-fuzzy' search
        const ultraFuzzy = cleanTitle.split(' ').slice(0, 3).join(' ');
        const finalTry = await axios.get(`${SAAVN_BASE}/search/songs`, { params: { query: ultraFuzzy, limit: 1 } });
        const finalSongs = finalTry.data?.data?.results || [];
        if (finalSongs.length > 0) {
            const dl = finalSongs[0].downloadUrl.find(u => u.quality === '320kbps') || finalSongs[0].downloadUrl[0];
            if (dl && dl.link) return res.redirect(dl.link);
        }

        // 4. Absolute Final Fallback: Direct YouTube Stream Proxy
        console.log(`Saavn mapping failed for ${id}, falling back to direct YT stream...`);
        const stream = ytdl(id, {
            filter: 'audioonly',
            quality: 'highestaudio',
            highWaterMark: 1 << 25 // 32MB buffer for smooth playback
        });
        
        res.setHeader('Content-Type', 'audio/mpeg');
        return stream.pipe(res);

    } catch (e) {
        console.error(`Stream Mapping Error for ${req.params.id}:`, e.message);
        if (!res.headersSent) res.status(500).send('Failed to stream audio');
    }
});

app.get('/api/songs/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const ytResults = await cachedYts({ videoId: id });
        if (!ytResults) {
            return res.status(404).json({ success: false, error: 'Song not found' });
        }

        const song = mapYtSong(ytResults);
        delete song._rawTitle;
        res.json({ success: true, data: [song] });
    } catch (e) {
        console.error("Song Fetch Error:", e.message);
        res.status(500).json({ success: false, error: 'Failed to fetch song data' });
    }
});

app.post('/api/listen', async (req, res) => {
    const { id, title, subtitle, image, downloadUrl } = req.body;
    try {
        const imgStr = JSON.stringify(image || []);
        const downloadUrlStr = JSON.stringify(downloadUrl || []);

        await db.execute({
            sql: `
            INSERT INTO listen_history (song_id, title, subtitle, image, downloadUrl, count, last_played)
            VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
            ON CONFLICT(song_id) DO UPDATE SET count = count + 1, last_played = CURRENT_TIMESTAMP
            `,
            args: [id, title, subtitle, imgStr, downloadUrlStr]
        });
        res.json({ success: true });
    } catch (e) {
        console.error("Listen Track Error:", e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/history/listens', async (req, res) => {
    try {
        const listensRs = await db.execute('SELECT * FROM listen_history ORDER BY last_played DESC LIMIT 15');
        const parsed = listensRs.rows.map(s => ({
            id: s.song_id,
            title: s.title,
            subtitle: s.subtitle,
            image: JSON.parse(s.image),
            downloadUrl: JSON.parse(s.downloadUrl)
        }));
        res.json({ success: true, data: parsed });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/recommendations', async (req, res) => {
    try {
        const listensRs = await db.execute('SELECT * FROM listen_history ORDER BY last_played DESC, count DESC LIMIT 5');
        let listens = listensRs.rows;
        
        // If NO history, fetch some trending stuff so home isn't empty
        if (listens.length === 0) {
            const trending = await cachedYts('trending songs 2024');
            const top5 = trending.videos.slice(0, 5);
            const cards = top5.map(v => ({
                type: 'mix',
                title: 'Trending Vibe',
                subtitle: v.title,
                image: [{ quality: '500x500', url: v.image || v.thumbnail }],
                songs: [mapYtSong(v)]
            }));
            return res.json({ success: true, data: cards });
        }

        const cards = await Promise.all(listens.map(async (listen) => {
            try {
                const baseSong = {
                    id: listen.song_id,
                    title: listen.title,
                    subtitle: listen.subtitle,
                    image: JSON.parse(listen.image),
                    downloadUrl: JSON.parse(listen.downloadUrl)
                };

                const mainArtist = listen.subtitle?.split(',')[0] || listen.title;
                const ytResults = await cachedYts(`${mainArtist} song`);
                const artistRaw = ytResults?.videos || [];

                const vibeSongs = artistRaw
                    .filter(song => song.videoId !== listen.song_id)
                    .map(mapYtSong)
                    .filter(song => {
                        const titleLower = song.title.toLowerCase();
                        return !['cover', 'lofi', 'remix', 'reverb', 'slowed', 'instrumental'].some(w => titleLower.includes(w));
                    })
                    .slice(0, 7);

                const mixedDeck = [baseSong, ...vibeSongs].map(s => { delete s._rawTitle; return s; });

                return {
                    type: 'mix',
                    title: `${mainArtist} Mix`,
                    subtitle: `Personalized for you`,
                    image: baseSong.image,
                    songs: mixedDeck
                };
            } catch (err) {
                console.error("YTS fetch error in recommendations:", err.message);
                return null;
            }
        }));

        res.json({ success: true, data: cards.filter(Boolean) });
    } catch (e) {
        console.error("Recommendations Error:", e.stack);
        res.status(500).json({ success: false, error: 'Failed to fetch recommendations' });
    }
});

app.get('/api/liked', async (req, res) => {
    try {
        const songsRs = await db.execute('SELECT * FROM liked_songs');
        const parsedSongs = songsRs.rows.map(s => ({
            ...s,
            downloadUrl: JSON.parse(s.downloadUrl),
            image: JSON.parse(s.image)
        }));
        res.json({ success: true, data: parsedSongs });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/liked', async (req, res) => {
    const { id, title, subtitle, image, downloadUrl } = req.body;
    try {
        const imgStr = JSON.stringify(image || []);
        const downloadUrlStr = JSON.stringify(downloadUrl || []);

        await db.execute({
            sql: 'INSERT OR REPLACE INTO liked_songs (id, title, subtitle, image, downloadUrl) VALUES (?, ?, ?, ?, ?)',
            args: [id, title, subtitle, imgStr, downloadUrlStr]
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.delete('/api/liked/:id', async (req, res) => {
    try {
        await db.execute({ sql: 'DELETE FROM liked_songs WHERE id = ?', args: [req.params.id] });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/playlists', async (req, res) => {
    try {
        // Fetch all playlists and all playlist songs in just 2 queries total instead of N+1
        const [playlistsRs, songsRs] = await Promise.all([
            db.execute('SELECT * FROM playlists'),
            db.execute('SELECT * FROM playlist_songs')
        ]);
        
        const allSongs = songsRs.rows;
        const result = playlistsRs.rows.map(p => {
            p.songs = allSongs
                .filter(s => s.playlist_id === p.id)
                .map(s => ({
                    id: s.song_id,
                    title: s.title,
                    subtitle: s.subtitle,
                    image: JSON.parse(s.image),
                    downloadUrl: JSON.parse(s.downloadUrl),
                    playlist_song_id: s.id
                }));
            return p;
        });
        res.json({ success: true, data: result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/playlists', async (req, res) => {
    const { name } = req.body;
    try {
        const info = await db.execute({ sql: 'INSERT INTO playlists (name) VALUES (?)', args: [name] });
        res.json({ success: true, data: { id: Number(info.lastInsertRowid), name, songs: [] } });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.delete('/api/playlists/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute({ sql: 'DELETE FROM playlist_songs WHERE playlist_id = ?', args: [id] });
        await db.execute({ sql: 'DELETE FROM playlists WHERE id = ?', args: [id] });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/playlists/:id/songs', async (req, res) => {
    const { song_id, title, subtitle, image, downloadUrl } = req.body;
    try {
        const imgStr = JSON.stringify(image || []);
        const downloadUrlStr = JSON.stringify(downloadUrl || []);
        const info = await db.execute({
            sql: 'INSERT INTO playlist_songs (playlist_id, song_id, title, subtitle, image, downloadUrl) VALUES (?, ?, ?, ?, ?, ?)',
            args: [req.params.id, song_id, title, subtitle, imgStr, downloadUrlStr]
        });
        res.json({ success: true, data: { playlist_song_id: Number(info.lastInsertRowid) } });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.delete('/api/playlists/songs/:playlist_song_id', async (req, res) => {
    try {
        await db.execute({ sql: 'DELETE FROM playlist_songs WHERE id = ?', args: [req.params.playlist_song_id] });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => console.log('Vibe server running on port ' + PORT));
