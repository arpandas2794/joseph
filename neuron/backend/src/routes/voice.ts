import { Router, Request, Response } from 'express';
import Groq from 'groq-sdk';
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

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    fs.unlinkSync(file.path);
    return res.status(500).json({ error: 'GROQ_API_KEY not configured' });
  }

  try {
    console.log(`Transcribing voice note: ${file.originalname} (${Math.round(file.size / 1024)}KB)`);

    const groq = new Groq({ apiKey });
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(file.path),
      model: "whisper-large-v3",
      response_format: "verbose_json",
    });

    const transcript = transcription.text.trim();
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
