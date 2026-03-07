const express = require('express');
const cors = require('cors');
const axios = require('axios');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize SQLite DB
const db = new Database(path.join(__dirname, 'spotify_clone.db'));
const yts = require('yt-search');

db.exec(`
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

// --- Proxy to Public JioSaavn API Wrapper ---
// This prevents CORS issues on the client and hides API details.
const SAAVN_BASE = 'https://jiosaavn-api-privatecvc2.vercel.app';

app.get('/api/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.status(400).json({ success: false, message: 'Query string required' });
        
        let searchQuery = q;
        try {
            // Intelligent YouTube Search mapping (helps catch lyrics strings and misspellings!)
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
        } catch(err) { console.error("YT mapping error:", err.message); }

        let response = await axios.get(`${SAAVN_BASE}/search/songs`, { 
            params: { query: searchQuery, limit: 30 } 
        });
        
        // Fallback to naive search if mapped search gets 0 results
        if(!response.data?.data?.results?.length && searchQuery !== q) {
             response = await axios.get(`${SAAVN_BASE}/search/songs`, { params: { query: q, limit: 30 } });
        }
        
        // Track the search
        try {
            db.prepare(`
                INSERT INTO search_history (term, count, last_searched) 
                VALUES (?, 1, CURRENT_TIMESTAMP)
                ON CONFLICT(term) DO UPDATE SET count = count + 1, last_searched = CURRENT_TIMESTAMP
            `).run(q.toLowerCase());
        } catch(err) { console.error("History logging error:", err.message); }
        
        const results = response.data?.data?.results || [];
        let formattedResults = results.map(song => ({
            id: song.id,
            title: song.name,
            subtitle: song.primaryArtists,
            image: (song.image || []).map(img => ({ quality: img.quality, url: img.link })),
            downloadUrl: (song.downloadUrl || []).map(dl => ({ quality: dl.quality, url: dl.link })),
            _rawTitle: song.name.toLowerCase()
        }));

        // Sort to penalty covers/lofi, boost exact
        const penaltyWords = ['cover', 'lofi', 'reverb', 'slowed', 'remix', 'instrumental', 'unplugged', 'reprise', 'mashup', '8d', 'karaoke'];
        const qLower = q.toLowerCase();

        formattedResults = formattedResults.sort((a, b) => {
             let aScore = 0;
             let bScore = 0;
             
             penaltyWords.forEach(w => {
                 if(a._rawTitle.includes(w)) aScore += 10;
                 if(b._rawTitle.includes(w)) bScore += 10;
             });

             if(a._rawTitle === qLower) aScore -= 20;
             if(b._rawTitle === qLower) bScore -= 20;
             if(a._rawTitle.startsWith(qLower)) aScore -= 5;
             if(b._rawTitle.startsWith(qLower)) bScore -= 5;

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

app.post('/api/listen', (req, res) => {
    const { id, title, subtitle, image, downloadUrl } = req.body;
    try {
        const imgStr = JSON.stringify(image || []);
        const downloadUrlStr = JSON.stringify(downloadUrl || []);
        
        db.prepare(`
            INSERT INTO listen_history (song_id, title, subtitle, image, downloadUrl, count, last_played)
            VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
            ON CONFLICT(song_id) DO UPDATE SET count = count + 1, last_played = CURRENT_TIMESTAMP
        `).run(id, title, subtitle, imgStr, downloadUrlStr);
        res.json({ success: true });
    } catch(e) {
        console.error("Listen Track Error:", e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/history/listens', (req, res) => {
    try {
        const listens = db.prepare('SELECT * FROM listen_history ORDER BY last_played DESC LIMIT 15').all();
        const parsed = listens.map(s => ({
            id: s.song_id,
            title: s.title,
            subtitle: s.subtitle,
            image: JSON.parse(s.image),
            downloadUrl: JSON.parse(s.downloadUrl)
        }));
        res.json({ success: true, data: parsed });
    } catch(e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/recommendations', async (req, res) => {
    try {
        // Reduced from 12 to 8 to keep Home Screen cleaner and more personalized
        const listens = db.prepare('SELECT * FROM listen_history ORDER BY last_played DESC, count DESC LIMIT 8').all();

        const cards = [];
        
        for (const listen of listens) {
            const mapSong = song => ({
                id: song.id,
                title: song.name,
                subtitle: song.primaryArtists,
                image: (song.image || []).map(img => ({ quality: img.quality, url: img.link })),
                downloadUrl: (song.downloadUrl || []).map(dl => ({ quality: dl.quality, url: dl.link }))
            });

            // Reconstruct the listened song object
            const baseSong = {
                 id: listen.song_id,
                 title: listen.title,
                 subtitle: listen.subtitle,
                 image: JSON.parse(listen.image),
                 downloadUrl: JSON.parse(listen.downloadUrl)
            };

            // Extract the primary artist to find vibe songs
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
                      .slice(0, 9); // Grab up to 9 vibe songs
            }

            // Mix them together: 1 base song + up to 9 vibe songs
            const mixedDeck = [baseSong, ...vibeSongs];
            
            if (mixedDeck.length > 0) {
                 cards.push({
                      type: 'mix',
                      title: `${mainArtist} Mix`,
                      subtitle: `Based on your recent listen: ${listen.title}`,
                      image: baseSong.image, // Use the base song's art as the cover for the mix bundle
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

// --- Personal DB Endpoints (Liked Songs) ---
app.get('/api/liked', (req, res) => {
    try {
        const songs = db.prepare('SELECT * FROM liked_songs').all();
        // Parse downloadUrl before sending back since it was stored as JSON string
        const parsedSongs = songs.map(s => ({
            ...s,
            downloadUrl: JSON.parse(s.downloadUrl),
            image: JSON.parse(s.image)
        }));
        res.json({ success: true, data: parsedSongs });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/liked', (req, res) => {
    const { id, title, subtitle, image, downloadUrl } = req.body;
    try {
        const imgStr = JSON.stringify(image || []);
        const downloadUrlStr = JSON.stringify(downloadUrl || []);
        
        db.prepare('INSERT OR REPLACE INTO liked_songs (id, title, subtitle, image, downloadUrl) VALUES (?, ?, ?, ?, ?)').run(
            id, title, subtitle, imgStr, downloadUrlStr
        );
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.delete('/api/liked/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM liked_songs WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- Personal DB Endpoints (Playlists) ---
app.get('/api/playlists', (req, res) => {
    try {
        const playlists = db.prepare('SELECT * FROM playlists').all();
        const result = playlists.map(p => {
            const songs = db.prepare('SELECT * FROM playlist_songs WHERE playlist_id = ?').all(p.id);
            p.songs = songs.map(s => ({
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

app.post('/api/playlists', (req, res) => {
    const { name } = req.body;
    try {
        const info = db.prepare('INSERT INTO playlists (name) VALUES (?)').run(name);
        res.json({ success: true, data: { id: info.lastInsertRowid, name, songs: [] } });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.delete('/api/playlists/:id', (req, res) => {
    try {
        const { id } = req.params;
        db.prepare('DELETE FROM playlist_songs WHERE playlist_id = ?').run(id);
        db.prepare('DELETE FROM playlists WHERE id = ?').run(id);
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/playlists/:id/songs', (req, res) => {
    const { song_id, title, subtitle, image, downloadUrl } = req.body;
    try {
        const imgStr = JSON.stringify(image || []);
        const downloadUrlStr = JSON.stringify(downloadUrl || []);
        const info = db.prepare('INSERT INTO playlist_songs (playlist_id, song_id, title, subtitle, image, downloadUrl) VALUES (?, ?, ?, ?, ?, ?)')
          .run(req.params.id, song_id, title, subtitle, imgStr, downloadUrlStr);
        res.json({ success: true, data: { playlist_song_id: info.lastInsertRowid } });
    } catch(e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.delete('/api/playlists/songs/:playlist_song_id', (req, res) => {
    try {
        db.prepare('DELETE FROM playlist_songs WHERE id = ?').run(req.params.playlist_song_id);
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Serve built frontend in production
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => console.log('Vibe server running on port ' + PORT));
