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
        'User-Agent': 'Mozilla/5.0'
      }
    });
    console.log("Cobalt Response:", res.data);
  } catch(e) {
    console.error(e.message);
  }
}
run();
