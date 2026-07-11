import axios from 'axios';
async function run() {
  try {
    const res = await axios.post('https://api.cobalt.tools/api/json', {
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      isAudioOnly: true
    }, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Origin': 'https://cobalt.tools',
        'Referer': 'https://cobalt.tools/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    console.log("Cobalt URL:", res.data.url);
  } catch(e) {
    console.log(e.response ? e.response.status + " " + JSON.stringify(e.response.data) : e.message);
  }
}
run();
