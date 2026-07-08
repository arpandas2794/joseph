import express, { Request, Response } from 'express';
import multer from 'multer';

const router = express.Router();
const upload = multer({ dest: '/tmp/' });

export const extractAudio = async (req: Request, res: Response) => {
    // Left blank for the other agent to implement YouTube transcription
    return res.json({ text: '[Pending Implementation from other agent]' });
};

router.post('/extract', upload.single('audioFile'), extractAudio);
export default router;
