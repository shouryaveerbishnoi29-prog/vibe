const express = require('express');
const yts = require('yt-search');
const axios = require('axios');
const app = express();

const SAAVN_BASE = 'https://jiosaavn-api-privatecvc2.vercel.app';

app.get('/stream/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const ytInfo = await yts({ videoId: id });
        if (!ytInfo) return res.status(404).send('Not found');

        let cleanTitle = ytInfo.title.split('|')[0]
            .replace(/[\\(\\[].*?[\\)\\]]/g, '')
            .replace(/official video/i, '')
            .replace(/music video/i, '')
            .trim();
        
        let author = ytInfo.author?.name?.replace(/vevo/i, '') || '';
        let query = `${cleanTitle} ${author}`.trim();

        console.log(`[STREAM] Resolving: ${query}`);
        const result = await axios.get(`${SAAVN_BASE}/search/songs`, { params: { query: query, limit: 1 } });
        const songs = result.data?.data?.results;

        if (!songs || songs.length === 0) {
            return res.status(404).send('Audio not found in proxy');
        }

        const exactSong = songs[0];
        const dl = exactSong.downloadUrl.find(u => u.quality === '320kbps') || exactSong.downloadUrl[0];
        
        console.log(`[STREAM] Redirecting to: ${dl.link}`);
        res.redirect(dl.link);
    } catch(e) {
        console.error("Stream Proxy Error:", e);
        res.status(500).send("Error");
    }
});

app.listen(3002, () => console.log('Test streamer on 3002'));
