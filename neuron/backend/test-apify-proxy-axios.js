require('dotenv').config({ path: '.env' });
const axios = require('axios');

async function testApifyProxy() {
  console.log('Testing Apify Proxy with Cobalt API...');
  const primaryApi = 'https://rue-cobalt.xenon.zone';
  const url = 'https://www.youtube.com/watch?v=xBfoFijhAqw';
  const postData = { url, downloadMode: 'audio', audioFormat: 'mp3' };
  
  const proxy = process.env.APIFY_TOKEN ? {
    protocol: 'http',
    host: 'proxy.apify.com',
    port: 8000,
    auth: {
      username: 'groups-RESIDENTIAL', // Try residential or just 'auto'
      password: process.env.APIFY_TOKEN
    }
  } : undefined;

  try {
    const res = await axios.post(primaryApi, postData, { 
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      proxy,
      timeout: 15000 
    });
    console.log('Success!', res.data);
  } catch(e) {
    console.error('Error:', e.message);
    if (e.response) {
       console.error('Status:', e.response.status, e.response.statusText);
    }
  }
}
testApifyProxy();
