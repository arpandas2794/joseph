import axios from 'axios';
async function run() {
  try {
    const targetUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
    const res = await axios.get(proxyUrl);
    const html = res.data.contents;
    
    // basic check for caption tracks
    const match = html.match(/"captionTracks":\[(.*?)\]/);
    if (match) {
      console.log("FOUND CAPTIONS VIA PROXY!");
      console.log(match[0].substring(0, 100));
    } else {
      console.log("No captions found in proxy HTML.");
    }
  } catch(e) {
    console.error(e.message);
  }
}
run();
