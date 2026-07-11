require('dotenv').config({ path: '.env' });
const { ApifyClient } = require('apify-client');

async function run() {
  const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
  try {
    console.log('Calling streamers/youtube-scraper...');
    const run = await client.actor('streamers/youtube-scraper').call({ startUrls: [{ url: 'https://www.youtube.com/watch?v=xBfoFijhAqw' }] });
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    console.log('Result keys:', Object.keys(items[0] || {}));
    if (items[0]) {
       console.log('Got item! Has streamUrl?', !!items[0].streamUrl);
       console.log(items[0]);
    }
  } catch(e) {
    console.error('Error:', e.message);
  }
}
run();
