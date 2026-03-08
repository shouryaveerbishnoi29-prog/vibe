const express = require('express');
const cors = require('cors');
const path = require('path');
const yts = require('yt-search');
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

// Map a YouTube video object to our standard formatting
const SAAVN_BASE = 'https://jiosaavn-api-privatecvc2.vercel.app';
const mapYtSong = (v) => {
    const title = v.title || '';
    const author = v.author?.name || 'Unknown Artist';
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

        const ytResults = await yts(q);
        let results = ytResults.videos || [];
        
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

        const penaltyWords = ['cover', 'lofi', 'reverb', 'slowed', 'remix', 'instrumental', 'unplugged', 'reprise', 'mashup', '8d', 'karaoke'];
        const qLower = q.toLowerCase();
        const activePenaltyWords = penaltyWords.filter(w => !qLower.includes(w));

        formattedResults = formattedResults.sort((a, b) => {
            let aScore = 0;
            let bScore = 0;

            activePenaltyWords.forEach(w => {
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

app.get('/api/stream/:id', async (req, res) => {
    try {
        const id = req.params.id;
        let title = req.query.t || '';
        let author = req.query.a || '';

        if (!title) {
            const ytInfo = await yts({ videoId: id });
            if (ytInfo) {
                title = ytInfo.title;
                author = ytInfo.author?.name || '';
            }
        }

        let cleanTitle = title.split('|')[0]
            .replace(/[(\[].*?[)\]]/g, '')
            .replace(/official video/i, '')
            .replace(/music video/i, '')
            .replace(/lyrical/i, '')
            .trim();
        
        author = author.replace(/vevo/i, '').trim();
        let query = `${cleanTitle} ${author}`.trim();

        const result = await axios.get(`${SAAVN_BASE}/search/songs`, { params: { query: query, limit: 1 } });
        const songs = result.data?.data?.results || [];

        if (songs.length > 0) {
            const exactSong = songs[0];
            const dl = exactSong.downloadUrl.find(u => u.quality === '320kbps') || exactSong.downloadUrl[0];
            if (dl && dl.link) {
                return res.redirect(dl.link);
            }
        }

        res.status(404).send('Audio stream mapped to NO_RESULTS');
    } catch (e) {
        console.error(`Stream Mapping Error for ${req.params.id}:`, e.message);
        if (!res.headersSent) res.status(500).send('Failed to stream audio');
    }
});

app.get('/api/songs/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const ytResults = await yts({ videoId: id });
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
        const listensRs = await db.execute('SELECT * FROM listen_history ORDER BY last_played DESC, count DESC LIMIT 8');
        const listens = listensRs.rows;

        const cards = [];

        for (const listen of listens) {
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
                // Search youtube for artist to get vibe songs
                const ytResults = await yts(`${mainArtist} song`);
                const artistRaw = ytResults?.videos || [];

                vibeSongs = artistRaw
                    .filter(song => song.videoId !== listen.song_id)
                    .map(mapYtSong)
                    .filter(song => {
                        const titleLower = song.title.toLowerCase();
                        return !['cover', 'lofi', 'remix', 'reverb', 'slowed', 'instrumental'].some(w => titleLower.includes(w));
                    })
                    .slice(0, 9);
            }

            const mixedDeck = [baseSong, ...vibeSongs].map(s => { delete s._rawTitle; return s; });

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
