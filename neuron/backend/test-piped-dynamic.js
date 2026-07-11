const axios = require('axios');

async function testPiped() {
  console.log('Fetching active Piped instances...');
  try {
    // Piped instances list is usually available at this community API
    const instancesRes = await axios.get('https://piped-instances.kavin.rocks/', { timeout: 10000 });
    const instances = instancesRes.data.filter(i => i.api_url && i.up_to_date);
    
    console.log(`Found ${instances.length} active instances. Testing top 5...`);
    
    const videoId = 'xBfoFijhAqw';
    
    for (let i = 0; i < Math.min(5, instances.length); i++) {
      const url = instances[i].api_url;
      console.log(`Testing ${url}...`);
      try {
        const streamRes = await axios.get(`${url}/streams/${videoId}`, { timeout: 10000 });
        if (streamRes.data && streamRes.data.audioStreams && streamRes.data.audioStreams.length > 0) {
           console.log(`Success on ${url}! Audio URL:`, streamRes.data.audioStreams[0].url.substring(0, 100));
           return;
        }
      } catch(e) {
        console.log(`Failed on ${url}:`, e.message);
      }
    }
  } catch (e) {
    console.error('Failed to fetch Piped instances:', e.message);
  }
}
testPiped();
