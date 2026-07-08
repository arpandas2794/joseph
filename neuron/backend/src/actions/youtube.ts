"use server";

import path from 'path';
import { execFile } from 'child_process';
import util from 'util';
import fs from 'fs/promises';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { YoutubeTranscript } from '@danielxceron/youtube-transcript';

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

function getVideoId(url: string) {
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
        const transcript = await YoutubeTranscript.fetchTranscript(videoId);
        if (transcript && transcript.length > 0) {
            console.log(`[YouTubeTranscript] youtube-transcript success.`);
            return transcript.map((i: any) => i.text).join(' ');
        }
    } catch (error: any) {
        console.warn(`[YouTubeTranscript] youtube-transcript failed: ${error.message}`);
    }

    // Method 2: Try Local yt-dlp (Robust but Slower)
    let subPath = '';
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

        const cookiesPath = process.env.YT_DLP_COOKIES_PATH || path.join(process.cwd(), 'cookies.txt');
        if (await fs.stat(cookiesPath).catch(() => null)) {
            args.push('--cookies', cookiesPath);
        }

        await execFilePromise(binaryPath, args);

        const files = await fs.readdir(tempDir);
        const subFile = files.find(f => f.startsWith(tempId) && f.endsWith('.vtt'));

        if (subFile) {
            console.log(`[YouTubeTranscript] yt-dlp success.`);
            subPath = path.join(tempDir, subFile);
            const content = await fs.readFile(subPath, 'utf-8');
            return cleanVTT(content);
        }
    } catch (error: any) {
        console.warn(`[YouTubeTranscript] yt-dlp failed: ${error.message.split('\n')[0]}...`);
    } finally {
        if (subPath) {
            try { await fs.unlink(subPath); } catch (e) { }
        }
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
    try {
        const binaryName = process.platform === 'darwin' ? 'yt-dlp' : 'yt-dlp-linux';
        const binaryPath = path.join(__dirname, '../../bin', binaryName);
        const envCookiesPath = process.env.YT_DLP_COOKIES_PATH || path.join(process.cwd(), 'cookies.txt');
        const cookiesPath = (await fs.stat(envCookiesPath).catch(() => null)) ? envCookiesPath : null;
        
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

        if (cookiesPath) args.push('--cookies', cookiesPath);
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

