"use server";

import path from 'path';
import { execFile } from 'child_process';
import util from 'util';
import fs from 'fs/promises';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { YoutubeTranscript } from '@danielxceron/youtube-transcript';
import { createReadStream } from 'fs';
import Groq from 'groq-sdk';

const execFilePromise = util.promisify(execFile);



function cleanVTT(content: string): string {
    // Basic VTT/TTML cleaner
    // 1. Remove Headers (WEBVTT)
    // 2. Remove Timestamps (00:00:00.000 --> ...)
    // 3. Remove Tags (<c.color>...</c>)
    const lines = content.split('\n');
    const cleaned = lines
        .filter(line =>
            !line.startsWith('WEBVTT') &&
            !line.includes('-->') &&
            line.trim().length > 0 &&
            isNaN(Number(line.trim())) // Remove pure index numbers
        )
        .map(line => line.replace(/<[^>]*>/g, '').trim()); // Strip HTML/VTT tags

    return cleaned.join(' ');
}

export function getVideoId(url: string) {
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname.includes('youtube.com')) {
            return urlObj.searchParams.get('v');
        } else if (urlObj.hostname.includes('youtu.be')) {
            return urlObj.pathname.slice(1);
        }
    } catch (e) { return null; }
    return null;
}

export async function fetchYouTubeTranscript(url: string): Promise<string | null> {
    const videoId = getVideoId(url);
    if (!videoId) return null;

    const tempId = uuidv4();
    const tempDir = os.tmpdir();
    const outputTemplate = path.join(tempDir, `${tempId}.%(ext)s`);
    const binaryName = process.platform === 'darwin' ? 'yt-dlp' : 'yt-dlp-linux';
    const binaryPath = path.join(__dirname, '../../bin', binaryName);

    // Method 1: Try youtube-transcript (Fastest and Most Reliable)
    try {
        console.log(`[YouTubeTranscript] Fetching transcript via youtube-transcript...`);
        let transcript;
        try {
            transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' });
        } catch (langErr: any) {
            console.warn(`[YouTubeTranscript] youtube-transcript English failed, trying default language: ${langErr.message}`);
            transcript = await YoutubeTranscript.fetchTranscript(videoId);
        }
        if (transcript && transcript.length > 0) {
            console.log(`[YouTubeTranscript] youtube-transcript success.`);
            return transcript.map((i: any) => i.text).join(' ');
        }
    } catch (error: any) {
        console.warn(`[YouTubeTranscript] youtube-transcript failed: ${error.message}`);
    }

    // Method 2: Try Local yt-dlp (Robust but Slower)
    let subPath = '';
    let tempCookiesPath = '';
    try {
        console.log(`[YouTubeTranscript] Fetching subs via yt-dlp for: ${videoId}`);
        
        const args = [
            url,
            '--ignore-no-formats-error',
            '--write-auto-subs',
            '--write-subs',
            '--sub-lang', 'en',
            '--skip-download',
            '--convert-subs', 'vtt',
            '-o', outputTemplate,
            '--no-check-certificates',
            '--no-warnings',
            '--extractor-args', 'youtubetab:skip=authcheck',
            '--user-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ];

        if (process.env.SOCIAL_MEDIA_PROXY) {
            args.push('--proxy', process.env.SOCIAL_MEDIA_PROXY);
        }

        const envCookiesPath = process.env.YT_DLP_COOKIES_PATH || path.join(process.cwd(), 'cookies.txt');
        if (await fs.stat(envCookiesPath).catch(() => null)) {
            // Copy cookies to writable temp dir to prevent write-back OSError on read-only file systems (like Render's secrets)
            tempCookiesPath = path.join(os.tmpdir(), `cookies-${tempId}.txt`);
            await fs.copyFile(envCookiesPath, tempCookiesPath);
            args.push('--cookies', tempCookiesPath);
        }

        const { stdout, stderr } = await execFilePromise(binaryPath, args);
        console.log(`[YouTubeTranscript] yt-dlp stdout:`, stdout);
        if (stderr) console.warn(`[YouTubeTranscript] yt-dlp stderr:`, stderr);

        const files = await fs.readdir(tempDir);
        const subFile = files.find(f => f.startsWith(tempId) && f.endsWith('.vtt'));

        if (subFile) {
            console.log(`[YouTubeTranscript] yt-dlp success.`);
            subPath = path.join(tempDir, subFile);
            const content = await fs.readFile(subPath, 'utf-8');
            return cleanVTT(content);
        }
    } catch (error: any) {
        console.warn(`[YouTubeTranscript] yt-dlp failed:`, error.message);
    } finally {
        if (subPath) {
            try { await fs.unlink(subPath); } catch (e) { }
        }
        if (tempCookiesPath) {
            try { await fs.unlink(tempCookiesPath); } catch (e) { }
        }
    }

    // Method 3: Try Apify YouTube Transcript Actor
    if (process.env.APIFY_TOKEN) {
        const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const { ApifyClient } = require('apify-client');
        const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

        // Try harshmaur/youtube-transcript-scraper first (more active and robust)
        try {
            console.log(`[YouTubeTranscript] Fetching transcript via Apify actor 'harshmaur/youtube-transcript-scraper' for: ${videoId}`);
            const run = await client.actor('harshmaur/youtube-transcript-scraper').call({ 
                videoUrls: [cleanUrl],
                language: 'en'
            });
            const { items } = await client.dataset(run.defaultDatasetId).listItems();
            if (items && items.length > 0) {
                // If it's a list of segments
                if (items.length > 1 && items[0].text !== undefined) {
                    const transcriptText = items.map((t: any) => t.text || '').join(' ');
                    if (transcriptText.trim().length > 0) {
                        console.log(`[YouTubeTranscript] Apify harshmaur success (multi-segment).`);
                        return transcriptText;
                    }
                }
                // If it's a single item containing the full text
                else {
                    let transcriptText = items[0].transcript || items[0].text;
                    if (Array.isArray(transcriptText)) {
                        transcriptText = transcriptText.map((t: any) => t.text || '').join(' ');
                    }
                    if (typeof transcriptText === 'string' && transcriptText.trim().length > 0) {
                        console.log(`[YouTubeTranscript] Apify harshmaur success (single item).`);
                        return transcriptText;
                    }
                }
            }
        } catch (apifyErr: any) {
            console.warn(`[YouTubeTranscript] Apify harshmaur failed: ${apifyErr.message}`);
        }

        // Try foudhil/actor-youtube-transcript as fallback
        try {
            console.log(`[YouTubeTranscript] Fetching transcript via Apify actor 'foudhil/actor-youtube-transcript' for: ${videoId}`);
            const run = await client.actor('foudhil/actor-youtube-transcript').call({ videoUrls: [cleanUrl] });
            const { items } = await client.dataset(run.defaultDatasetId).listItems();
            if (items && items.length > 0) {
                let transcriptText = items[0].transcript || items[0].text;
                if (transcriptText) {
                    if (Array.isArray(transcriptText)) {
                        transcriptText = transcriptText.map((t: any) => t.text || '').join(' ');
                    }
                    if (typeof transcriptText === 'string' && transcriptText.trim().length > 0) {
                        console.log(`[YouTubeTranscript] Apify foudhil success.`);
                        return transcriptText;
                    }
                }
            }
        } catch (apifyErr: any) {
            console.warn(`[YouTubeTranscript] Apify foudhil failed: ${apifyErr.message}`);
        }
    } else {
        console.log(`[YouTubeTranscript] APIFY_TOKEN is not set, skipping Apify fallback.`);
    }

    // Method 4: Try Cobalt download + Groq Whisper transcription (Bulletproof audio transcription fallback)
    if (process.env.GROQ_API_KEY) {
        try {
            console.log(`[YouTubeTranscript] Fetching transcript via Cobalt + Groq Whisper for: ${videoId}`);
            const tempAudioPath = path.join(os.tmpdir(), `yt-audio-${uuidv4()}.mp3`);
            
            const cobaltUrl = await fetchCobaltAudioUrl(url);
            if (cobaltUrl) {
                console.log(`[YouTubeTranscript] Downloading audio from Cobalt: ${cobaltUrl}`);
                const response = await axios({
                    method: 'GET',
                    url: cobaltUrl,
                    responseType: 'stream'
                });
                
                // Write stream using fs
                const { createWriteStream } = require('fs');
                const writer = createWriteStream(tempAudioPath);
                response.data.pipe(writer);
                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });
                
                console.log(`[YouTubeTranscript] Audio downloaded, transcribing via Groq...`);
                const transcriptText = await transcribeAudioWithGroq(tempAudioPath);
                
                // Clean up audio file
                try { await fs.unlink(tempAudioPath); } catch (e) { }
                
                if (transcriptText && transcriptText.trim().length > 0) {
                    console.log(`[YouTubeTranscript] Groq success.`);
                    return transcriptText;
                }
            }
        } catch (groqErr: any) {
            console.warn(`[YouTubeTranscript] Cobalt/Groq fallback failed: ${groqErr.message}`);
        }
    } else {
        console.log(`[YouTubeTranscript] GROQ_API_KEY is not set, skipping Groq fallback.`);
    }

    console.error(`[YouTubeTranscript] All methods failed for ${videoId}`);
    return null;
}


export async function getYouTubeMetadata(url: string): Promise<{ title: string; duration: number } | null> {
    // 0. Try HTML Scraping (FASTEST: ~200ms) - Gets Duration + Title without yt-dlp
    try {
        const videoId = getVideoId(url);
        if (videoId) {
            const htmlRes = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                timeout: 3000
            });
            const html = htmlRes.data;

            // Extract Title
            const titleMatch = html.match(/<title>(.*?) - YouTube<\/title>/) || html.match(/<meta name="title" content="(.*?)">/);
            const title = titleMatch ? titleMatch[1] : null;

            // Extract Duration (approxDurationMs)
            const durationMatch = html.match(/"approxDurationMs":"(\d+)"/);
            const durationSeconds = durationMatch ? parseInt(durationMatch[1]) / 1000 : 0;

            if (title && durationSeconds > 0) {
                return {
                    title: title,
                    duration: durationSeconds
                };
            }
        }
    } catch (e) {
        // Scraping failed, proceed to yt-dlp
    }

    // 1. Try yt-dlp (Robust but Slower)
    let tempCookiesPath = '';
    try {
        const binaryName = process.platform === 'darwin' ? 'yt-dlp' : 'yt-dlp-linux';
        const binaryPath = path.join(__dirname, '../../bin', binaryName);
        const envCookiesPath = process.env.YT_DLP_COOKIES_PATH || path.join(process.cwd(), 'cookies.txt');
        
        const cacheDir = path.join(process.cwd(), '.yt-dlp-cache');
        const hasCacheDir = (await fs.stat(cacheDir).catch(() => null));

        const args = [
            url,
            '--ignore-no-formats-error',
            '--print', '{"title": %(title)j, "duration": %(duration)j}',
            '--flat-playlist',
            '--skip-download',
            '--no-warnings',
            '--no-check-certificates',
            '--extractor-args', 'youtubetab:skip=authcheck',
            '--user-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            '--referer', 'https://www.youtube.com/'
        ];

        if (await fs.stat(envCookiesPath).catch(() => null)) {
            tempCookiesPath = path.join(os.tmpdir(), `cookies-meta-${uuidv4()}.txt`);
            await fs.copyFile(envCookiesPath, tempCookiesPath);
            args.push('--cookies', tempCookiesPath);
        }
        if (hasCacheDir) args.push('--cache-dir', cacheDir);

        // Executing binary safely
        const { stdout } = await execFilePromise(binaryPath, args);

        const firstBrace = stdout.indexOf('{');
        const lastBrace = stdout.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1) {
            const jsonString = stdout.substring(firstBrace, lastBrace + 1);
            const data = JSON.parse(jsonString);

            // Validate data
            if (data.title) {
                return {
                    title: data.title,
                    duration: data.duration || 0
                };
            }
        }
    } catch (error: any) {
        console.warn("[YouTubeMetadata] yt-dlp failed, trying fallback:", error.message);
    } finally {
        if (tempCookiesPath) {
            try { await fs.unlink(tempCookiesPath); } catch (e) { }
        }
    }

    // 2. Fallback to oEmbed (Fast, but no duration)
    try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
        const response = await axios.get(oembedUrl, { timeout: 2000 });
        if (response.data && response.data.title) {
            return {
                title: response.data.title,
                duration: 0 // oEmbed doesn't provide duration
            };
        }
    } catch (e) {
        // oEmbed failed
    }

    return null;
}

// Helpers for Cobalt download + Groq transcription

async function fetchCobaltAudioUrl(url: string): Promise<string | null> {
  const apis = [
    "https://api-cobalt.eversiege.network",
    "https://cobaltapi.squair.xyz",
    "https://api.qwkuns.me",
    "https://nuko-c.meowing.de",
    "https://lime.clxxped.lol",
    "https://rue-cobalt.xenon.zone"
  ];
  const postData = { url, downloadMode: 'audio', audioFormat: 'mp3' };
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };

  for (const api of apis) {
    try {
      const res = await axios.post(api, postData, { headers, timeout: 8000 });
      if (res.data && res.data.url) return res.data.url;
    } catch (err: any) {
      console.warn(`Cobalt API ${api} failed:`, err.message);
    }
  }

  try {
    const dirRes = await axios.get('https://cobalt.directory/api/working?type=api', { timeout: 10000 });
    const dirApis = dirRes.data?.data?.youtube;
    if (dirApis && Array.isArray(dirApis)) {
      for (const api of dirApis) {
        if (apis.includes(api)) continue;
        try {
          const res = await axios.post(api, postData, { headers, timeout: 10000 });
          if (res.data && res.data.url) return res.data.url;
        } catch (e: any) {
          console.warn(`Fallback Cobalt API ${api} failed:`, e.message);
        }
      }
    }
  } catch (err: any) {
    console.warn('Failed to fetch Cobalt directory:', err.message);
  }
  return null;
}

async function transcribeAudioWithGroq(audioPath: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('Groq API key is missing. Please set GROQ_API_KEY in your backend .env file to enable transcribing.');
  }

  const groq = new Groq({ apiKey });
  console.log(`Uploading audio to Groq Whisper API: ${audioPath}`);

  try {
    const transcription = await groq.audio.transcriptions.create({
      file: createReadStream(audioPath),
      model: "whisper-large-v3",
      response_format: "verbose_json",
    });
    
    console.log('Transcript generated with Groq whisper-large-v3.');
    return transcription.text || '';
  } catch (err: any) {
    console.error('Groq transcription failed:', err.message || err);
    throw new Error('Groq transcription failed: ' + (err.message || 'Unknown error'));
  }
}

