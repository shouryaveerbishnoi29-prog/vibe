const axios = require('axios');
const yts = require('yt-search');
const SAAVN_BASE = 'https://jiosaavn-api-privatecvc2.vercel.app';

async function testHybrid() {
    const query = process.argv[2] || 'blinding lights';
    console.log('Searching YT for:', query);
    const ytResult = await yts(query);
    const ytSongs = ytResult.videos.slice(0, 5);
    
    for (const yt of ytSongs) {
        // clean title
        let q = yt.title.split('|')[0].replace(/[\\(\\[].*?[\\)\\]]/g, '').trim();
        q = q.replace(/official video/i, '').replace(/music video/i, '').trim();
        // Add artist to query to improve accuracy
        let jioRes;
        try {
            // first attempt exact text
            jioRes = await axios.get(`${SAAVN_BASE}/search/songs`, { params: { query: q, limit: 3 } });
            if (!jioRes.data?.data?.results?.length) throw new Error();
        } catch(e) {
            // fallback attempt yt author + title
            let fallbackQ = yt.author?.name + ' ' + q;
            jioRes = await axios.get(`${SAAVN_BASE}/search/songs`, { params: { query: fallbackQ, limit: 3 } });
        }
        
        const saavnMatch = jioRes.data?.data?.results?.[0]; // just grab first since Saavn sorts by relevance
        if (saavnMatch) {
            console.log(`[YT] ${yt.title} -> [Saavn] ${saavnMatch.name} (${saavnMatch.primaryArtists}) | Stream: ${saavnMatch.downloadUrl ? 'YES' : 'NO'}`);
        } else {
            console.log(`[YT] ${yt.title} -> [Saavn] NO MATCH`);
        }
    }
}
testHybrid();
