import axios from 'axios';
async function run() {
  try {
    const res = await axios.get('https://pipedapi.kavin.rocks/streams/dQw4w9WgXcQ');
    console.log("Audio Streams:", res.data.audioStreams.length);
    console.log("First Audio URL:", res.data.audioStreams[0].url.substring(0, 100));
  } catch(e) {
    console.error(e.message);
  }
}
run();
