const axios = require('axios');
async function run() {
  try {
    const res = await axios.get(`https://api.apify.com/v2/store/actors?search=youtube&token=${process.env.APIFY_TOKEN}`);
    const actors = res.data.data.items.slice(0, 5).map(a => a.name);
    console.log("Found Actors:", actors);
  } catch(e) {
    console.error(e.message);
  }
}
run();
