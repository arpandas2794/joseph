const { ApifyClient } = require('apify-client');
async function run() {
  const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
  try {
    const run = await client.actor('foudhil/actor-youtube-transcript').call({ videoUrls: ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'] });
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    console.log("Transcript length:", items[0]?.transcript?.length || items[0]?.text?.length);
    console.log(items[0]);
  } catch(e) {
    console.error("ERROR:", e.message);
  }
}
run();
