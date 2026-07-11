import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
async function run() {
  try {
    const token = process.env.APIFY_TOKEN;
    const proxyUrl = `http://auto:${token}@proxy.apify.com:8000`;
    const agent = new HttpsProxyAgent(proxyUrl);
    const res = await axios.get('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
      httpsAgent: agent,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    console.log("HTML length:", res.data.length);
    const match = res.data.match(/"captionTracks":\[(.*?)\]/);
    if (match) {
      console.log("FOUND CAPTIONS VIA APIFY PROXY!");
    } else {
      console.log("No captions found.");
    }
  } catch(e) {
    console.error(e.message);
  }
}
run();
