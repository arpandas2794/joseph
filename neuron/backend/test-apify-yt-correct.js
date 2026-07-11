require('dotenv').config({ path: '.env' });
const { ApifyClient } = require('apify-client');

async function run() {
  const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
  try {
    console.log('Calling boztek-ltd/youtube-downloader with correct schema...');
    const run = await client.actor('boztek-ltd/youtube-downloader').call({
       startUrls: [{ url: 'https://www.youtube.com/watch?v=xBfoFijhAqw' }],
       downloadType: 'audio'
    });
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    console.log('Result keys:', Object.keys(items[0] || {}));
    if (items[0]) {
       console.log('Item Output:', JSON.stringify(items[0], null, 2));
    }
  } catch(e) {
    console.error('Error:', e.message);
  }
}
run();
