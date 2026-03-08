const axios = require('axios');
const yts = require('yt-search');
const SAAVN_BASE = 'https://jiosaavn-api-privatecvc2.vercel.app';

async function testStreaming() {
    const t1 = Date.now();
    const ytResult = await yts('blinding lights the weeknd');
    const ytSong = ytResult.videos[0];
    const cleanTitle = ytSong.title.split('|')[0].replace(/[\\(\\[].*?[\\)\\]]/g, '').trim();
    
    console.log(`[${Date.now() - t1}ms] Found YT Song: ${cleanTitle}`);
    
    const t2 = Date.now();
    const jioRes = await axios.get(`${SAAVN_BASE}/search/songs`, { params: { query: cleanTitle, limit: 1 } });
    const jioSong = jioRes.data?.data?.results?.[0];
    
    if (jioSong) {
        console.log(`[${Date.now() - t2}ms] Mapped to Saavn: ${jioSong.name}. URL:`, jioSong.downloadUrl[jioSong.downloadUrl.length-1].url);
    } else {
        console.log('Saavn failed to map');
    }
}
testStreaming();
