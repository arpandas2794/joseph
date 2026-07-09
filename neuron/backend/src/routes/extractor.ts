import express, { Request, Response } from 'express';
import multer from 'multer';
import axios from 'axios';
import { fetchYouTubeTranscript, getVideoId } from '../actions/youtube';

const router = express.Router();
const upload = multer({ dest: '/tmp/' });

export const extractAudio = async (req: Request, res: Response) => {
    try {
        const url = req.body.url;
        if (!url) return res.status(400).json({ error: 'No URL provided' });

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
