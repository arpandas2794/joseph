const { ApifyClient } = require('apify-client');
require('dotenv').config();
async function run() {
  const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
  const store = await client.store().list();
  console.log(store.items.filter(i => i.name.toLowerCase().includes('youtube')).map(i => i.name));
}
run().catch(console.error);
