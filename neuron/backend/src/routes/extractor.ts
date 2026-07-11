import express, { Request, Response } from 'express';
import multer from 'multer';
import axios from 'axios';
import { fetchYouTubeTranscript, getVideoId } from '../actions/youtube';
import { fetchInstagramContent } from '../actions/instagram';

const router = express.Router();
const upload = multer({ dest: '/tmp/' });

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

export const extractAudio = async (req: Request, res: Response) => {
    try {
        const url = req.body.url as string;
        if (!url) return res.status(400).json({ error: 'No URL provided' });

        const urlLower = url.toLowerCase();
        const isInstagram = urlLower.includes('instagram.com') || urlLower.includes('instagr.am');
        if (isInstagram) {
            const host = req.get('host') || 'localhost:3001';
            const protocol = req.protocol || 'http';
            const result = await fetchInstagramContent(url, host, protocol);
            return res.json(result);
        }

        let title = 'YouTube Video';
        let channel = 'YouTube Channel';
        let thumbnail = '';

        try {
            const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
            const response = await axios.get(oembedUrl);
            title = response.data.title || title;
            channel = response.data.author_name || channel;
            thumbnail = response.data.thumbnail_url || thumbnail;
        } catch (err: any) {
            console.warn('oEmbed metadata fetch failed:', err.message);
        }

        const transcriptText = await fetchYouTubeTranscript(url);
        
        return res.json({
            type: 'youtube',
            content: transcriptText || '[No audio extracted, and no closed captions available]',
            metadata: {
                title,
                channel,
                videoId: getVideoId(url) || url,
                thumbnail
            }
        });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Failed to extract' });
    }
};

router.post('/extract', upload.single('audioFile'), extractAudio);
export default router;
