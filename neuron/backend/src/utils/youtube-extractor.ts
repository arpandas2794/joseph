import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import axios from 'axios';
import Groq from 'groq-sdk';
import { YoutubeTranscript } from 'youtube-transcript';
import { ApifyClient } from 'apify-client';

const execAsync = util.promisify(exec);

// Automatically select the correct binary based on OS
const binaryName = process.platform === 'darwin' ? 'yt-dlp' : 'yt-dlp-linux';
const YTDLP_PATH = path.join(process.cwd(), 'bin', binaryName);

async function runYtdlpWithCookies(args: string, url: string): Promise<string> {
  const localCookiesPath = path.join(process.cwd(), 'cookies.txt');
  let cookiesArg = '';

  if (fs.existsSync(localCookiesPath)) {
    console.log('Using local cookies.txt for authentication');
    cookiesArg = `--cookies "${localCookiesPath}"`;
  }

  const { stdout } = await execAsync(`"${YTDLP_PATH}" ${cookiesArg} ${args} "${url}"`, {
    maxBuffer: 1024 * 1024 * 50
  });
  return stdout;
}

async function transcribeAudioWithGroq(audioPath: string): Promise<string> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const transcription = await groq.audio.transcriptions.create({
    file: fs.createReadStream(audioPath),
    model: "whisper-large-v3",
    response_format: "verbose_json",
  });
  return transcription.text || '';
}

async function fetchCobaltAudioUrl(url: string): Promise<string | null> {
  const apis = [
    "https://api-cobalt.eversiege.network",
    "https://cobaltapi.squair.xyz",
    "https://api.qwkuns.me"
  ];
  const postData = { url, downloadMode: 'audio', audioFormat: 'mp3' };
  const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };

  for (const api of apis) {
    try {
      const res = await axios.post(api, postData, { headers, timeout: 8000 });
      if (res.data && res.data.url) return res.data.url;
    } catch (err) {
      continue;
    }
  }
  return null;
}

export async function extractYouTubeTranscript(url: string): Promise<string> {
  let transcriptText = '';
  const tempAudioPath = path.join('/tmp', `yt_audio_${Date.now()}.mp3`);
  
  const hasCookies = fs.existsSync(path.join(process.cwd(), 'cookies.txt'));
  
  // CRITICAL BYPASS: `player_skip=webpage,configs,js` bypasses HTTP 429 IP blocks!
  const clientArgs = hasCookies 
    ? '--extractor-args "youtube:player_client=tv,web;player_skip=webpage,configs,js"'
    : '--extractor-args "youtube:player_client=android,ios,tv,web;player_skip=webpage,configs,js"';

  try {
    // Layer 1: Try local yt-dlp extraction
    await runYtdlpWithCookies(`-x --audio-format mp3 ${clientArgs} -o "${tempAudioPath}"`, url);
    transcriptText = await transcribeAudioWithGroq(tempAudioPath);
  } catch (err) {
    console.warn('Local yt-dlp failed, trying Cobalt...');
    try {
      // Layer 2: Try Cobalt API fallback
      const cobaltUrl = await fetchCobaltAudioUrl(url);
      if (cobaltUrl) {
        const response = await axios({ method: 'GET', url: cobaltUrl, responseType: 'stream' });
        const writer = fs.createWriteStream(tempAudioPath);
        response.data.pipe(writer);
        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });
        transcriptText = await transcribeAudioWithGroq(tempAudioPath);
      }
    } catch (cobaltErr) {
      console.warn('Cobalt failed, trying closed captions...');
    }
  }

  // Layer 3: Try Native Closed Captions
  if (!transcriptText) {
    try {
      const transcriptItems = await YoutubeTranscript.fetchTranscript(url);
      transcriptText = transcriptItems.map((item: any) => item.text).join(' ');
    } catch (ytErr) {
      console.warn('Native transcript failed, trying Apify Proxy...');
    }
  }

  // Layer 4: Try Apify Proxy Actor
  if (!transcriptText && process.env.APIFY_TOKEN) {
    try {
      const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
      const run = await client.actor('foudhil/actor-youtube-transcript').call({ videoUrls: [url] });
      const { items } = await client.dataset(run.defaultDatasetId as string).listItems();
      if (items && items.length > 0 && (items[0] as any).transcript) {
        transcriptText = (items[0] as any).transcript;
      }
    } catch (apifyErr) {
      console.warn('Apify failed.');
    }
  }

  // Cleanup Temp File
  if (fs.existsSync(tempAudioPath)) {
    fs.unlinkSync(tempAudioPath);
  }

  return transcriptText || '[No audio extracted, and no closed captions available]';
}
