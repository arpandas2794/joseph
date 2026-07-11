const { ApifyClient } = require('apify-client');
require('dotenv').config();
async function run() {
  const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
  const store = await client.store().list();
  const match = store.items.find(i => i.name === 'youtube-to-mp3-audio-downloader');
  console.log(match.username + '/' + match.name);
}
run().catch(console.error);
