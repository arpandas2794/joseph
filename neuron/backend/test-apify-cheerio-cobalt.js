require('dotenv').config({ path: '.env' });
const { ApifyClient } = require('apify-client');

async function run() {
  const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
  try {
    console.log('Calling apify/cheerio-scraper as a proxy for Cobalt...');
    
    // We inject custom JS into the cheerio scraper to make a POST request to Cobalt from Apify's environment
    const run = await client.actor('apify/cheerio-scraper').call({
      startUrls: [{ url: 'https://rue-cobalt.xenon.zone' }], // Just a dummy start URL
      pageFunction: `async function pageFunction(context) {
          const res = await context.request.userData.axios.post('https://rue-cobalt.xenon.zone', {
              url: 'https://www.youtube.com/watch?v=xBfoFijhAqw',
              downloadMode: 'audio',
              audioFormat: 'mp3'
          }, {
              headers: {
                  'Accept': 'application/json',
                  'Content-Type': 'application/json',
                  'User-Agent': 'Mozilla/5.0'
              }
          });
          return res.data;
      }`,
      preNavigationHooks: `[
          async ({ request }) => {
              const axios = require('axios');
              request.userData.axios = axios;
          }
      ]`
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    console.log('Result:', items);
  } catch(e) {
    console.error('Error:', e.message);
  }
}
run();
