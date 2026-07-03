import { Router, Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const router = Router();
const upload = multer({ dest: '/tmp/voice-uploads/' });

const TEMP_DIR = '/tmp/voice-uploads';
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

router.post('/transcribe-voice', upload.single('audio'), async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'No audio file provided' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    fs.unlinkSync(file.path);
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  try {
    console.log(`Transcribing voice note: ${file.originalname} (${Math.round(file.size / 1024)}KB)`);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Read the uploaded audio file as base64
    const audioBuffer = fs.readFileSync(file.path);
    const base64Audio = audioBuffer.toString('base64');

    // Detect mime type from extension or default to webm
    const mimeType = (file.mimetype as 'audio/webm' | 'audio/mp4' | 'audio/ogg' | 'audio/wav') || 'audio/webm';

    const prompt = `Transcribe the following audio recording exactly as spoken. 
Include all words, natural pauses (indicated by commas or line breaks), and preserve the speaker's intent.
Format as clean, readable paragraphs. If the audio is unclear in places, do your best and continue.
Do not add any commentary — only output the transcription.`;

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Audio,
          mimeType,
        },
      },
      prompt,
    ]);

    const transcript = result.response.text().trim();
    console.log(`Transcription complete: ${transcript.length} characters`);

    // Clean up temp file
    fs.unlinkSync(file.path);

    return res.json({ transcript });
  } catch (err: any) {
    console.error('Voice transcription failed:', err.message || err);
    // Clean up on error
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    return res.status(500).json({ error: err.message || 'Transcription failed' });
  }
});

export default router;
