require('dotenv').config({ path: 'neuron/backend/.env' });
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const Groq = require('groq-sdk');

async function fetchCobaltAudioUrl(url) {
  const primaryApi = 'https://rue-cobalt.xenon.zone';
  const postData = { url, downloadMode: 'audio', audioFormat: 'mp3' };
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  };

  try {
    console.log('Trying primary API:', primaryApi);
    const res = await axios.post(primaryApi, postData, { headers, timeout: 10000 });
    if (res.data && res.data.url) return res.data.url;
  } catch (err) {
    console.warn('Primary Cobalt API failed:', err.message);
  }
  return null;
}

async function run() {
  const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  console.log('Fetching cobalt url...');
  const cobaltUrl = await fetchCobaltAudioUrl(url);
  console.log('Cobalt URL:', cobaltUrl);
  
  if (cobaltUrl) {
    const tempAudioPath = path.join(__dirname, `test-audio-${Date.now()}.mp3`);
    try {
      console.log('Downloading stream to', tempAudioPath);
      const response = await axios({
        method: 'GET',
        url: cobaltUrl,
        responseType: 'stream'
      });
      const writer = fs.createWriteStream(tempAudioPath);
      response.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      console.log('File downloaded! Size:', fs.statSync(tempAudioPath).size);
    } catch(e) {
      console.error('Download failed:', e.message);
    }
  }
}
run();
