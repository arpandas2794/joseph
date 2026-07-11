import axios from 'axios';
async function run() {
  try {
    const res = await axios.post('https://co.wuk.sh/api/json', {
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      isAudioOnly: true
    }, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    console.log("Cobalt URL:", res.data.url);
  } catch(e) {
    console.log(e.response ? e.response.status : e.message);
  }
}
run();
