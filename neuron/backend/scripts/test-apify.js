const { ApifyClient } = require('apify-client');
require('dotenv').config();

async function testApify() {
  const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
  console.log('Starting Apify scrape...');
  const run = await client.actor('streamers/youtube-scraper').call({ 
    startUrls: [{ url: 'https://www.youtube.com/watch?v=xBfoFijhAqw' }],
    maxResults: 1
  });
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  
  if (items && items.length > 0) {
    const video = items[0];
    console.log('Title:', video.title);
    console.log('Has streams:', !!video.streams);
    
    // Find audio stream
    if (video.streams) {
      const audioStreams = video.streams.filter(s => s.type === 'audio');
      console.log('Audio streams found:', audioStreams.length);
      if (audioStreams.length > 0) {
        console.log('First audio stream URL:', audioStreams[0].url.substring(0, 100) + '...');
      }
    }
  } else {
    console.log('No items returned');
  }
}

testApify().catch(console.error);
