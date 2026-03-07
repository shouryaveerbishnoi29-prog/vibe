const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const yts = require('yt-search');
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

// --- Proxy to Public JioSaavn API Wrapper ---
const SAAVN_BASE = 'https://jiosaavn-api-privatecvc2.vercel.app';

app.get('/api/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.status(400).json({ success: false, message: 'Query string required' });

        let searchQuery = q;
        try {
            const ytResults = await yts(q);
            if (ytResults && ytResults.videos.length > 0) {
                let ytTitle = ytResults.videos[0].title;
                ytTitle = ytTitle.split('|')[0]
                    .replace(/full song:?/i, '')
                    .replace(/official.*/i, '')
                    .replace(/lyrical:?/i, '')
                    .split(' - ')[0]
                    .replace(/[\(\[].*?[\)\]]/g, '')
                    .trim();
                if (ytTitle.length > 2) {
                    searchQuery = ytTitle;
                }
            }
        } catch (err) { console.error("YT mapping error:", err.message); }

        let response = await axios.get(`${SAAVN_BASE}/search/songs`, {
            params: { query: searchQuery, limit: 30 }
        });

        if (!response.data?.data?.results?.length && searchQuery !== q) {
            response = await axios.get(`${SAAVN_BASE}/search/songs`, { params: { query: q, limit: 30 } });
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

        const results = response.data?.data?.results || [];
        let formattedResults = results.map(song => ({
            id: song.id,
            title: song.name,
            subtitle: song.primaryArtists,
            image: (song.image || []).map(img => ({ quality: img.quality, url: img.link })),
            downloadUrl: (song.downloadUrl || []).map(dl => ({ quality: dl.quality, url: dl.link })),
            _rawTitle: song.name.toLowerCase()
        }));

        const penaltyWords = ['cover', 'lofi', 'reverb', 'slowed', 'remix', 'instrumental', 'unplugged', 'reprise', 'mashup', '8d', 'karaoke'];
        const qLower = q.toLowerCase();

        formattedResults = formattedResults.sort((a, b) => {
            let aScore = 0;
            let bScore = 0;

            penaltyWords.forEach(w => {
                if (a._rawTitle.includes(w)) aScore += 10;
                if (b._rawTitle.includes(w)) bScore += 10;
            });

            if (a._rawTitle === qLower) aScore -= 20;
            if (b._rawTitle === qLower) bScore -= 20;
            if (a._rawTitle.startsWith(qLower)) aScore -= 5;
            if (b._rawTitle.startsWith(qLower)) bScore -= 5;

            return aScore - bScore;
        });

        formattedResults.forEach(r => delete r._rawTitle);

        res.json({ success: true, data: { results: formattedResults } });
    } catch (e) {
        console.error("Search Error:", e.message);
        res.status(500).json({ success: false, error: 'Failed to fetch search results' });
    }
});

app.get('/api/songs/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const response = await axios.get(`${SAAVN_BASE}/songs`, {
            params: { ids: id }
        });

        const results = response.data?.data || [];
        const formattedResults = results.map(song => ({
            id: song.id,
            title: song.name,
            subtitle: song.primaryArtists,
            image: (song.image || []).map(img => ({ quality: img.quality, url: img.link })),
            downloadUrl: (song.downloadUrl || []).map(dl => ({ quality: dl.quality, url: dl.link }))
        }));

        res.json({ success: true, data: formattedResults });
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
        const listensRs = await db.execute('SELECT * FROM listen_history ORDER BY last_played DESC, count DESC LIMIT 8');
        const listens = listensRs.rows;

        const cards = [];

        for (const listen of listens) {
            const mapSong = song => ({
                id: song.id,
                title: song.name,
                subtitle: song.primaryArtists,
                image: (song.image || []).map(img => ({ quality: img.quality, url: img.link })),
                downloadUrl: (song.downloadUrl || []).map(dl => ({ quality: dl.quality, url: dl.link }))
            });

            const baseSong = {
                id: listen.song_id,
                title: listen.title,
                subtitle: listen.subtitle,
                image: JSON.parse(listen.image),
                downloadUrl: JSON.parse(listen.downloadUrl)
            };

            const mainArtist = listen.subtitle?.split(',')[0] || listen.title;
            let vibeSongs = [];

            if (mainArtist) {
                const artistResponse = await axios.get(`${SAAVN_BASE}/search/songs`, { params: { query: mainArtist, limit: 15 } });
                const artistRaw = artistResponse.data?.data?.results || [];

                vibeSongs = artistRaw
                    .filter(song => song.id !== listen.song_id)
                    .map(mapSong)
                    .filter(song => {
                        const titleLower = song.title.toLowerCase();
                        return !['cover', 'lofi', 'remix', 'reverb', 'slowed', 'instrumental'].some(w => titleLower.includes(w));
                    })
                    .slice(0, 9);
            }

            const mixedDeck = [baseSong, ...vibeSongs];

            if (mixedDeck.length > 0) {
                cards.push({
                    type: 'mix',
                    title: `${mainArtist} Mix`,
                    subtitle: `Based on your recent listen: ${listen.title}`,
                    image: baseSong.image,
                    songs: mixedDeck
                });
            }
        }

        res.json({ success: true, data: cards });
    } catch (e) {
        console.error("Recommendations Error:", e.message);
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
        const playlistsRs = await db.execute('SELECT * FROM playlists');
        const result = await Promise.all(playlistsRs.rows.map(async p => {
            const songsRs = await db.execute({ sql: 'SELECT * FROM playlist_songs WHERE playlist_id = ?', args: [p.id] });
            p.songs = songsRs.rows.map(s => ({
                id: s.song_id,
                title: s.title,
                subtitle: s.subtitle,
                image: JSON.parse(s.image),
                downloadUrl: JSON.parse(s.downloadUrl),
                playlist_song_id: s.id
            }));
            return p;
        }));
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
