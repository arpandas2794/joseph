import axios from 'axios';
async function run() {
  try {
    const res = await axios.get('https://corsproxy.io/?https://www.youtube.com/watch?v=dQw4w9WgXcQ', { timeout: 10000 });
    const html = res.data;
    console.log("HTML length:", html.length);
    const match = html.match(/"captionTracks":\[(.*?)\]/);
    if (match) {
      console.log("FOUND CAPTIONS!");
    } else {
      console.log("No captions found.");
    }
  } catch(e) {
    console.log(e.message);
  }
}
run();
