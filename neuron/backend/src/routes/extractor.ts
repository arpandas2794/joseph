import express, { Request, Response } from 'express';
import multer from 'multer';
import { fetchYouTubeTranscript } from '../actions/youtube';

const router = express.Router();
const upload = multer({ dest: '/tmp/' });

export const extractAudio = async (req: Request, res: Response) => {
    try {
        const url = req.body.url;
        if (!url) return res.status(400).json({ error: 'No URL provided' });

        const transcriptText = await fetchYouTubeTranscript(url);
        
        return res.json({ text: transcriptText || '[No audio extracted, and no closed captions available]' });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Failed to extract' });
    }
};

router.post('/extract', upload.single('audioFile'), extractAudio);
export default router;
