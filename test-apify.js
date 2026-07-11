const { ApifyClient } = require('apify-client');
async function run() {
  const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
  try {
    const run = await client.actor('foudhil/actor-youtube-transcript').call({ videoUrls: ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'] });
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    console.log(items[0]);
  } catch(e) {
    console.error(e);
  }
}
run();
