require('dotenv').config({ path: 'neuron/backend/.env' });
const { ApifyClient } = require('apify-client');

async function run() {
  const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
  try {
    console.log('Calling apify/youtube-scraper...');
    const run = await client.actor('apify/youtube-scraper').call({ startUrls: [{ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }] });
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    console.log('Result keys:', Object.keys(items[0] || {}));
    if (items[0] && items[0].streamUrl) console.log('Stream URL:', items[0].streamUrl.substring(0, 50));
    if (items[0] && items[0].videoUrl) console.log('Video URL:', items[0].videoUrl.substring(0, 50));
  } catch(e) {
    console.error('Error:', e.message);
  }
}
run();
