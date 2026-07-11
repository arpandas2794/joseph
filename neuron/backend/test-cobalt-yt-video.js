require('dotenv').config({ path: '.env' });
const axios = require('axios');

async function test() {
  const primaryApi = 'https://rue-cobalt.xenon.zone';
  const url = 'https://www.youtube.com/watch?v=xBfoFijhAqw';
  const postData = { url, downloadMode: 'audio', audioFormat: 'mp3' };
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0'
  };
  try {
    const res = await axios.post(primaryApi, postData, { headers, timeout: 10000 });
    console.log('Cobalt Response:', res.data);
  } catch(e) {
    console.error('Cobalt Error:', e.response?.data || e.message);
  }
}
test();
