require('dotenv').config({ path: '.env' });
const { ApifyClient } = require('apify-client');

async function run() {
  const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
  try {
    const act = await client.actor('boztek-ltd/youtube-downloader').get();
    console.log('Actor details:', act);
  } catch(e) {
    console.error('Error:', e.message);
  }
}
run();
