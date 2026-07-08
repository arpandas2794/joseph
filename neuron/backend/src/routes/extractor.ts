import { Router, Request, Response } from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import Groq from 'groq-sdk';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { YoutubeTranscript } from 'youtube-transcript';

const execAsync = promisify(exec);
const router = Router();

// Ensure temp directory exists inside project workspace
const TEMP_DIR = path.join(__dirname, '../../temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Pick the right yt-dlp binary for the current platform
// bin/yt-dlp       = macOS standalone (committed)
// bin/yt-dlp-linux = Linux standalone (committed, used on Render)
const YTDLP_PATH = process.platform === 'linux'
  ? path.join(__dirname, '../../bin/yt-dlp-linux')
  : path.join(__dirname, '../../bin/yt-dlp');

async function runYtdlpWithCookies(args: string, url: string): Promise<string> {
  const localCookiesPath = path.join(__dirname, '../../cookies.txt');
  const renderCookiesPath = '/etc/secrets/cookies.txt';
  let cookiesArg = '';

  if (fs.existsSync(renderCookiesPath)) {
    console.log('Using Render secret cookies.txt for authentication');
    cookiesArg = `--cookies "${renderCookiesPath}"`;
  } else if (fs.existsSync(localCookiesPath)) {
    console.log('Using local cookies.txt for authentication');
    cookiesArg = `--cookies "${localCookiesPath}"`;
  }

  const { stdout } = await execAsync(`"${YTDLP_PATH}" ${cookiesArg} ${args} "${url}"`, {
    maxBuffer: 1024 * 1024 * 50
  });
  return stdout;
}

// Proxy endpoint to bypass CDN hotlinking protection (CORS / 403 Forbidden)
router.get('/proxy-image', async (req: Request, res: Response) => {
  const imageUrl = req.query.url as string;
  if (!imageUrl) {
    return res.status(400).send('URL is required');
  }

  try {
    const response = await axios.get(imageUrl, {
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    res.setHeader('Content-Type', (response.headers['content-type'] as string) || 'image/jpeg');
    // Enable caching for better performance
    res.setHeader('Cache-Control', 'public, max-age=86400');
    response.data.pipe(res);
  } catch (err: any) {
    console.error('Image proxy failed:', err.message || err);
    res.status(500).send('Failed to fetch image');
  }
});

// OCR all carousel slides using Gemini Vision — extracts visible text from each image
async function ocrSlidesWithGemini(slideUrls: string[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return 'Gemini API key is missing. Add GEMINI_API_KEY to your .env to enable OCR on carousel slides.';
  }

  if (slideUrls.length === 0) return '';

  console.log(`Running Gemini OCR on ${slideUrls.length} carousel slides...`);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
  const modelNames = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-latest'];
  let model: any = null;
  for (const modelName of modelNames) {
    try {
      model = genAI.getGenerativeModel({ model: modelName });
      break;
    } catch (_) {}
  }
  if (!model) model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // Download each slide image as a base64 buffer
    const imageParts: any[] = [];
    for (let i = 0; i < slideUrls.length; i++) {
      const slideUrl = slideUrls[i];
      if (!slideUrl) continue;
      try {
        const response = await axios.get(slideUrl, {
          responseType: 'arraybuffer',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          timeout: 15000,
        });
        const base64 = Buffer.from(response.data as ArrayBuffer).toString('base64');
        const contentTypeRaw = (response.headers['content-type'] as string | undefined) ?? 'image/jpeg';
        const mimeRaw = contentTypeRaw.split(';')[0]?.trim() ?? 'image/jpeg';
        const mimeType = (mimeRaw === 'image/png' || mimeRaw === 'image/webp') ? mimeRaw : 'image/jpeg';
        imageParts.push({ inlineData: { data: base64, mimeType } });
        console.log(`  Downloaded slide ${i + 1}/${slideUrls.length}`);
      } catch (dlErr: any) {
        console.warn(`  Failed to download slide ${i + 1}: ${dlErr.message}`);
      }
    }

    if (imageParts.length === 0) {
      return 'Could not download any slides for OCR.';
    }

    // Build prompt: label each image by slide number and ask Gemini to extract text
    const slideLabels = imageParts.map((_, i) => `Slide ${i + 1}`).join(', ');
    const prompt = `You are given ${imageParts.length} images from an Instagram carousel post (${slideLabels}).

For each slide:
1. Extract ALL visible text exactly as it appears (headlines, body text, captions, hashtags, etc.)
2. Label each slide clearly as "--- Slide N ---"
3. If a slide has no text, write "[No text on this slide]"
4. Preserve the reading order and structure of the text.

Do not describe the images — only extract the text content.`;

    let ocrText = '';
    const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-latest'];
    for (const modelName of models) {
      try {
        const m = genAI.getGenerativeModel({ model: modelName });
        const result = await m.generateContent([...imageParts, prompt]);
        ocrText = result.response.text().trim();
        console.log(`Gemini OCR complete with ${modelName}. Extracted ${ocrText.length} characters.`);
        break;
      } catch (err: any) {
        if (err.message?.includes('503') || err.message?.includes('overloaded') || err.message?.includes('high demand')) {
          console.warn(`${modelName} unavailable (503), trying next model...`);
          continue;
        }
        throw err;
      }
    }
    return ocrText || 'OCR returned no text.';
  } catch (err: any) {
    console.error('Gemini OCR failed:', err.message || err);
    return `OCR failed: ${err.message || 'Unknown error'}`;
  }
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
      file: fs.createReadStream(audioPath),
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

async function fetchSocialMediaMetadataApify(url: string, isInstagram: boolean): Promise<any> {
  const token = process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN;
  if (!token) throw new Error('APIFY_TOKEN is not set');

  const actorId = isInstagram ? 'apify~instagram-scraper' : 'clockwork~tiktok-scraper';
  
  const input = isInstagram 
    ? { directUrls: [url], resultsType: 'details' }
    : { urls: [url] };

  console.log(`Starting Apify ${isInstagram ? 'Instagram' : 'TikTok'} scraping...`);
  
  // Run Apify actor
  const runRes = await axios.post(`https://api.apify.com/v2/acts/${actorId}/runs?token=${token}`, input);
  const runId = runRes.data.data.id;
  const datasetId = runRes.data.data.defaultDatasetId;

  // Poll for completion
  let finished = false;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const statusRes = await axios.get(`https://api.apify.com/v2/acts/${actorId}/runs/${runId}?token=${token}`);
    const status = statusRes.data.data.status;
    
    if (status === 'SUCCEEDED') {
      finished = true;
      break;
    } else if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) {
      throw new Error(`Apify run failed with status: ${status}`);
    }
  }

  if (!finished) throw new Error('Apify scraping timed out');

  const datasetRes = await axios.get(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`);
  const items = datasetRes.data || [];
  const item = items[0];

  if (!item) return null;

  if (isInstagram) {
    const images: string[] = item.images || [];
    const isCarousel = images.length > 1;
    return {
      videoUrl: item.videoUrl,
      thumbnail: item.displayUrl || item.thumbnailUrl,
      title: item.caption || (isCarousel ? 'Instagram Carousel' : 'Instagram Reel'),
      channel: item.ownerUsername || 'Instagram Creator',
      slides: isCarousel ? images : [],
      isCarousel,
    };
  } else {
    return {
      videoUrl: item.videoUrl || item.downloadAddr,
      thumbnail: item.coverUrl || item.dynamicCover,
      title: item.desc || 'TikTok Video',
      channel: item.author?.uniqueId || 'TikTok Creator',
      slides: [],
      isCarousel: false,
    };
  }
}

async function extractWebsiteMetadata(url: string): Promise<any> {
  try {
    const htmlRes = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(htmlRes.data);
    const title = $('title').text() || $('meta[property="og:title"]').attr('content') || '';
    const description = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
    const image = $('meta[property="og:image"]').attr('content') || '';
    
    // Extract main text content
    $('script, style, nav, footer, header').remove();
    const content = $('body').text().replace(/\s+/g, ' ').trim();
    
    return { title, description, image, content };
  } catch (err) {
    return null;
  }
}

async function fetchCobaltAudioUrl(url: string): Promise<string | null> {
  // Hardcoded list of active instances to avoid cobalt.directory 403 blocks on Render
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

  // 1. Try hardcoded instances first (some may not use Cloudflare and will allow Render IPs)
  for (const api of apis) {
    try {
      const res = await axios.post(api, postData, { headers, timeout: 8000 });
      if (res.data && res.data.url) return res.data.url;
    } catch (err: any) {
      console.warn(`Cobalt API ${api} failed:`, err.message);
    }
  }

  // 2. Fallback: fetch working instances from cobalt.directory dynamically
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

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, TEMP_DIR),
    // Force .mp3 extension so Groq can detect the audio format
    filename: (_req, _file, cb) => cb(null, `upload-${Date.now()}.mp3`),
  }),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit for audio uploads
});

router.post('/extract', upload.single('audioFile'), async (req: Request, res: Response) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const isYoutube = url.includes('youtube.com') || url.includes('youtu.be');
    const isLoom = url.includes('loom.com/share');
    const isInstagram = url.includes('instagram.com');
    const isTikTok = url.includes('tiktok.com');
    const isGoogleDocs = url.includes('docs.google.com/document');
    const isGoogleSheets = url.includes('docs.google.com/spreadsheets');

    // 0. Google Drive Extraction
    if (isGoogleDocs || isGoogleSheets) {
      let documentId = '';
      const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        documentId = match[1];
      } else {
        return res.status(400).json({ error: 'Invalid Google Drive URL format.' });
      }

      const isDoc = isGoogleDocs;
      const exportFormat = isDoc ? 'txt' : 'csv';
      const exportUrl = `https://docs.google.com/${isDoc ? 'document' : 'spreadsheets'}/d/${documentId}/export?format=${exportFormat}`;

      const response = await axios.get(exportUrl, { responseType: 'text' });
      const text = response.data;

      let title = isDoc ? 'Google Doc' : 'Google Sheet';
      try {
        const htmlRes = await axios.get(url);
        const $ = cheerio.load(htmlRes.data);
        const pageTitle = $('title').text();
        if (pageTitle) {
          title = pageTitle.replace(' - Google Docs', '').replace(' - Google Sheets', '').trim();
        }
      } catch (titleErr) {}

      return res.json({
        type: 'google_drive',
        metadata: {
          title,
          url,
          documentType: isDoc ? 'document' : 'spreadsheet',
        },
        content: text
      });
    }

    // 1. YouTube & Loom Extraction
    if (isYoutube || isLoom) {
      let title = isLoom ? 'Loom Video' : 'YouTube Video';
      let channel = isLoom ? 'Loom Creator' : 'YouTube Channel';
      let thumbnail = '';
      let videoId = 'unknown';

      // Use oEmbed for highly reliable metadata (bypasses Render/AWS IP blocks)
      if (isYoutube) {
        try {
          const oembedRes = await axios.get(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
          if (oembedRes.data) {
            title = oembedRes.data.title || title;
            channel = oembedRes.data.author_name || channel;
            thumbnail = oembedRes.data.thumbnail_url || '';
            const vMatch = url.match(/[?&]v=([^&#]*)/);
            const shortMatch = url.match(/youtu\.be\/([^&#]*)/);
            videoId = (vMatch && vMatch[1]) || (shortMatch && shortMatch[1]) || videoId;
          }
        } catch (err: any) {
          console.warn('oEmbed metadata fetch failed:', err.message);
        }
      } else {
        // Fallback for Loom metadata
        try {
          const metaStdout = await runYtdlpWithCookies('--dump-json --no-playlist', url);
          const metadata = JSON.parse(metaStdout);
          videoId = metadata.id || videoId;
          title = metadata.title || title;
          channel = metadata.uploader || channel;
          thumbnail = metadata.thumbnail || '';
        } catch (err: any) {
          console.warn('Loom metadata fetch failed:', err.message);
        }
      }

      // Audio Extraction & Transcription (Try Groq first, fallback to closed captions)
      let transcriptText = '';
      const prefix = isLoom ? 'loom' : 'yt';
      const tempAudioPath = req.file ? req.file.path : path.join(TEMP_DIR, `${prefix}-${Date.now()}.mp3`);
      
      try {
        if (req.file) {
          console.log(`Received frontend-downloaded audio file: ${req.file.path}`);
          transcriptText = await transcribeAudioWithGroq(tempAudioPath);
        } else {
          // Use android,ios client spoofing to heavily reduce 429 Too Many Requests blocks on Datacenter IPs
          await runYtdlpWithCookies(`-x --audio-format mp3 --extractor-args "youtube:player_client=android,ios,web" -o "${tempAudioPath}"`, url);
          transcriptText = await transcribeAudioWithGroq(tempAudioPath);
        }
      } catch (err: any) {
        console.warn(`Local audio extraction failed:`, err.message);
        
        if (isYoutube) {
          console.log('Attempting Cobalt Downloader API as a direct audio fallback...');
          try {
            const cobaltUrl = await fetchCobaltAudioUrl(url);
            if (cobaltUrl) {
              console.log('Successfully got direct audio stream from Cobalt, downloading...');
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
              transcriptText = await transcribeAudioWithGroq(tempAudioPath);
            }
          } catch (cobaltErr: any) {
            console.warn('Cobalt audio fallback failed:', cobaltErr.message);
          }
        }

        if (isYoutube && (!transcriptText || transcriptText.trim() === '')) {
          try {
            console.log('Attempting native youtube-transcript package as final fallback...');
            const transcriptItems = await YoutubeTranscript.fetchTranscript(url);
            if (transcriptItems && transcriptItems.length > 0) {
              transcriptText = transcriptItems.map((item: any) => item.text).join(' ');
              console.log('Successfully fell back to native youtube-transcript.');
            }
          } catch (ytErr: any) {
            console.warn('Native youtube-transcript fallback also failed:', ytErr.message);
          }
          
          if (!transcriptText || transcriptText.trim() === '') {
            transcriptText = '[No audio extracted, and no closed captions available]';
          }
        } else if (!isYoutube && (!transcriptText || transcriptText.trim() === '')) {
          transcriptText = '[Audio extraction failed]';
        }
      }

      // Clean up temp file
      if (fs.existsSync(tempAudioPath)) {
        fs.unlinkSync(tempAudioPath);
      }

      return res.json({
        type: isLoom ? 'loom' : 'youtube',
        metadata: {
          title,
          channel,
          videoId,
          thumbnail,
        },
        content: transcriptText
      });
    }

    // 2. Instagram / TikTok Extraction
    if (isInstagram || isTikTok) {
      const apifyMetadata = await fetchSocialMediaMetadataApify(url, isInstagram);
      
      let thumbnail = '';
      let title = isInstagram ? 'Instagram Post' : 'TikTok Video';
      let channel = '';
      
      if (apifyMetadata) {
        thumbnail = apifyMetadata.thumbnail 
          ? `http://localhost:3001/api/proxy-image?url=${encodeURIComponent(apifyMetadata.thumbnail)}`
          : '';
        title = apifyMetadata.title || title;
        channel = apifyMetadata.channel || '';

        // --- Handle Carousel Post ---
        if (apifyMetadata.isCarousel && apifyMetadata.slides && apifyMetadata.slides.length > 0) {
          const host = req.get('host');
          const protocol = req.protocol;
          
          // Proxy all slide images to avoid CORS/hotlink issues in the frontend
          const proxiedSlides = apifyMetadata.slides.map((slideUrl: string) =>
            `${protocol}://${host}/api/proxy-image?url=${encodeURIComponent(slideUrl)}`
          );
          
          const proxyThumb = apifyMetadata.thumbnail
            ? `${protocol}://${host}/api/proxy-image?url=${encodeURIComponent(apifyMetadata.thumbnail)}`
            : proxiedSlides[0] || '';

          // Run OCR on ALL slides using Gemini Vision
          const ocrText = await ocrSlidesWithGemini(apifyMetadata.slides);

          // Build combined content: OCR text + post caption
          let combinedContent = '';
          if (ocrText && !ocrText.startsWith('OCR failed') && !ocrText.startsWith('Could not')) {
            combinedContent += ocrText;
          }
          if (apifyMetadata.title) {
            combinedContent += combinedContent ? `\n\n--- Post Caption ---\n${apifyMetadata.title}` : apifyMetadata.title;
          }

          return res.json({
            type: 'instagram_carousel',
            metadata: {
              url,
              title: apifyMetadata.title || 'Instagram Carousel',
              channel: apifyMetadata.channel || 'Instagram Creator',
              thumbnail: proxyThumb,
              slides: proxiedSlides,
              slideCount: proxiedSlides.length,
            },
            content: combinedContent,
          });
        }
      }

      const tempAudioPath = path.join(TEMP_DIR, `social-${Date.now()}.mp3`);
      await runYtdlpWithCookies(`-x --audio-format mp3 -o "${tempAudioPath}"`, apifyMetadata?.videoUrl || url);

      const transcriptText = await transcribeAudioWithGroq(tempAudioPath);

      // Clean up temp file
      if (fs.existsSync(tempAudioPath)) {
        fs.unlinkSync(tempAudioPath);
      }

      return res.json({
        type: isInstagram ? 'instagram' : 'tiktok',
        metadata: {
          title,
          channel,
          thumbnail,
        },
        content: transcriptText
      });
    }

    // 3. Fallback: Generic Website Scraper
    const result = await extractWebsiteMetadata(url);
    if (!result) {
      return res.status(400).json({ error: 'Failed to extract content from URL' });
    }

    return res.json({
      type: 'website',
      metadata: {
        title: result.title || 'Untitled',
        description: result.description || '',
        thumbnail: result.image || '',
        url: url
      },
      content: result.content
    });

  } catch (error: any) {
    console.error('Extraction error:', error.message);
    return res.status(500).json({ error: `Failed to extract content: ${error.message}` });
  }
});

export default router;
