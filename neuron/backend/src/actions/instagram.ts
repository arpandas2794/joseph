import path from 'path';
import { execFile } from 'child_process';
import util from 'util';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';

const execFilePromise = util.promisify(execFile);

// Helper to transcribe audio file using Groq Whisper API
async function transcribeAudioWithGroq(audioPath: string): Promise<string> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        throw new Error('Groq API key is missing. Please set GROQ_API_KEY in your backend .env file to enable transcribing.');
    }

    const groq = new Groq({ apiKey });
    console.log(`[Instagram] Uploading audio to Groq Whisper API: ${audioPath}`);

    try {
        const stream = (await import('fs')).createReadStream(audioPath);
        const transcription = await groq.audio.transcriptions.create({
            file: stream,
            model: "whisper-large-v3",
            response_format: "verbose_json",
        });
        
        console.log('[Instagram] Transcript generated with Groq whisper-large-v3.');
        return transcription.text || '';
    } catch (err: any) {
        console.error('[Instagram] Groq transcription failed:', err.message || err);
        throw new Error('Groq transcription failed: ' + (err.message || 'Unknown error'));
    }
}

// OCR all carousel slides using Gemini Vision
async function ocrSlidesWithGemini(slideUrls: string[]): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return 'Gemini API key is missing. Add GEMINI_API_KEY to your .env to enable OCR on carousel slides.';
    }

    if (slideUrls.length === 0) return '';
    console.log(`[Instagram] Running Gemini OCR on ${slideUrls.length} carousel slides...`);

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

        const slideLabels = imageParts.map((_, i) => `Slide ${i + 1}`).join(', ');
        const prompt = `You are given ${imageParts.length} images from an Instagram carousel post (${slideLabels}).

For each slide:
1. Extract ALL visible text exactly as it appears (headlines, body text, captions, hashtags, etc.)
2. Label each slide clearly as "--- Slide N ---"
3. If a slide has no text, write "[No text on this slide]"
4. Preserve the reading order and structure of the text.

Do not describe the images — only extract the text content.`;

        let ocrText = '';
        for (const modelName of modelNames) {
            try {
                const m = genAI.getGenerativeModel({ model: modelName });
                const result = await m.generateContent([...imageParts, prompt]);
                ocrText = result.response.text().trim();
                console.log(`[Instagram] Gemini OCR complete with ${modelName}. Extracted ${ocrText.length} characters.`);
                break;
            } catch (err: any) {
                if (err.message?.includes('503') || err.message?.includes('overloaded')) {
                    console.warn(`[Instagram] ${modelName} unavailable, trying next model...`);
                    continue;
                }
                throw err;
            }
        }
        return ocrText || 'OCR returned no text.';
    } catch (err: any) {
        console.error('[Instagram] Gemini OCR failed:', err.message || err);
        return `OCR failed: ${err.message || 'Unknown error'}`;
    }
}

// Fetch Instagram metadata using Apify
async function fetchSocialMediaMetadataApify(url: string): Promise<any> {
    const token = process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN;
    if (!token) throw new Error('APIFY_TOKEN is not set');

    const actorId = 'apify~instagram-scraper';
    const input = { directUrls: [url], resultsType: 'details' };

    console.log(`[Instagram] Starting Apify Instagram scraping...`);
    const runRes = await axios.post(`https://api.apify.com/v2/acts/${actorId}/runs?token=${token}`, input);
    const runId = runRes.data.data.id;
    const datasetId = runRes.data.data.defaultDatasetId;

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
}

// Download Reel via yt-dlp and transcribe
async function extractReelTranscript(url: string, videoUrl: string | undefined): Promise<string> {
    const tempId = uuidv4();
    const tempDir = os.tmpdir();
    const tempAudioPath = path.join(tempDir, `insta-${tempId}.mp3`);
    let tempCookiesPath = '';

    try {
        const binaryName = process.platform === 'darwin' ? 'yt-dlp' : 'yt-dlp-linux';
        const binaryPath = path.join(__dirname, '../../bin', binaryName);

        const args = [
            videoUrl || url,
            '-x',
            '--audio-format', 'mp3',
            '-o', tempAudioPath,
            '--no-check-certificates',
            '--no-warnings'
        ];

        if (process.env.SOCIAL_MEDIA_PROXY) {
            args.push('--proxy', process.env.SOCIAL_MEDIA_PROXY);
        }

        const envCookiesPath = process.env.YT_DLP_COOKIES_PATH || path.join(process.cwd(), 'cookies.txt');
        if (await fs.stat(envCookiesPath).catch(() => null)) {
            tempCookiesPath = path.join(os.tmpdir(), `cookies-insta-${tempId}.txt`);
            await fs.copyFile(envCookiesPath, tempCookiesPath);
            args.push('--cookies', tempCookiesPath);
        }

        await execFilePromise(binaryPath, args);
        const transcriptText = await transcribeAudioWithGroq(tempAudioPath);
        return transcriptText;
    } catch (err: any) {
        console.error('[Instagram] Reel extraction/transcription failed:', err.message || err);
        return '[Audio extraction failed]';
    } finally {
        if (existsSync(tempAudioPath)) {
            try { await fs.unlink(tempAudioPath); } catch (e) {}
        }
        if (tempCookiesPath && existsSync(tempCookiesPath)) {
            try { await fs.unlink(tempCookiesPath); } catch (e) {}
        }
    }
}

export async function fetchInstagramContent(url: string, host: string, protocol: string): Promise<any> {
    const apifyMetadata = await fetchSocialMediaMetadataApify(url);
    if (!apifyMetadata) {
        throw new Error('Failed to scrape Instagram metadata via Apify.');
    }

    const { thumbnail, title, channel, slides, isCarousel, videoUrl } = apifyMetadata;

    const proxyThumb = thumbnail 
        ? `${protocol}://${host}/api/proxy-image?url=${encodeURIComponent(thumbnail)}`
        : '';

    if (isCarousel && slides && slides.length > 0) {
        const proxiedSlides = slides.map((slideUrl: string) =>
            `${protocol}://${host}/api/proxy-image?url=${encodeURIComponent(slideUrl)}`
        );
        const ocrText = await ocrSlidesWithGemini(slides);
        
        let combinedContent = '';
        if (ocrText && !ocrText.startsWith('OCR failed') && !ocrText.startsWith('Could not')) {
            combinedContent += ocrText;
        }
        if (title) {
            combinedContent += combinedContent ? `\n\n--- Post Caption ---\n${title}` : title;
        }

        return {
            type: 'instagram_carousel',
            metadata: {
                url,
                title: title || 'Instagram Carousel',
                channel: channel || 'Instagram Creator',
                thumbnail: proxyThumb || proxiedSlides[0] || '',
                slides: proxiedSlides,
                slideCount: proxiedSlides.length,
            },
            content: combinedContent,
        };
    } else {
        const transcriptText = await extractReelTranscript(url, videoUrl);
        return {
            type: 'instagram',
            metadata: {
                url,
                title: title || 'Instagram Reel',
                channel: channel || 'Instagram Creator',
                thumbnail: proxyThumb,
            },
            content: transcriptText,
        };
    }
}
