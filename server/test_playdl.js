const play = require('play-dl');

async function test() {
    try {
        const t1 = Date.now();
        console.log('Searching...');
        const s = await play.search('blinding lights', { limit: 1 });
        console.log('Found:', s[0].title, (Date.now() - t1) + 'ms');

        const t2 = Date.now();
        console.log('Extracting stream...');
        const stream = await play.stream(s[0].url);
        console.log('Stream URL generated in', (Date.now() - t2) + 'ms');
        console.log(stream.url.substring(0, 100) + '...');
    } catch(e) {
        console.error(e);
    }
}
test();
