import axios from 'axios';
async function run() {
  const instances = [
    'https://pipedapi.smnz.de',
    'https://api.piped.projectsegfau.lt',
    'https://pipedapi.tokhmi.xyz',
    'https://pipedapi.kavin.rocks'
  ];
  for (const api of instances) {
    try {
      const res = await axios.get(`${api}/streams/dQw4w9WgXcQ`, { timeout: 5000 });
      if (res.data && res.data.subtitles) {
        console.log(`SUCCESS with ${api}! Subtitles:`, res.data.subtitles.length);
        return;
      }
    } catch(e) {
      console.log(`Failed ${api}:`, e.message);
    }
  }
}
run();
