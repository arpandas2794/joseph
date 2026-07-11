const axios = require('axios');

async function testInvidious() {
  const videoId = 'xBfoFijhAqw';
  // Common public Invidious instances
  const instances = [
    'https://vid.puffyan.us',
    'https://invidious.jing.rocks',
    'https://invidious.nerdvpn.de',
    'https://invidious.slipfox.xyz',
    'https://inv.tux.pizza'
  ];

  for (const url of instances) {
    console.log(`Trying ${url}...`);
    try {
      const res = await axios.get(`${url}/api/v1/videos/${videoId}`, { timeout: 10000 });
      if (res.data && res.data.adaptiveFormats) {
        const audioFormats = res.data.adaptiveFormats.filter(f => f.type.includes('audio'));
        if (audioFormats.length > 0) {
           console.log(`Success on ${url}! Audio URL:`, audioFormats[0].url.substring(0, 100));
           return;
        }
      }
    } catch(e) {
       console.log(`Failed on ${url}:`, e.message);
    }
  }
}
testInvidious();
