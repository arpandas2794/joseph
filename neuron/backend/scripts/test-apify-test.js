const { ApifyClient } = require('apify-client');
require('dotenv').config();
async function run() {
  const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
  console.log('Running actor...');
  const run = await client.actor('lurkapi/youtube-to-mp3-audio-downloader').call({ 
    startUrls: [{ url: 'https://www.youtube.com/watch?v=xBfoFijhAqw' }] 
  });
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  console.log(JSON.stringify(items, null, 2));
}
run().catch(console.error);
