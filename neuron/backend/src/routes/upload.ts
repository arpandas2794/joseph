import { Router, Request, Response } from 'express';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { v4 as uuidv4 } from 'uuid';

import mammoth from 'mammoth';
import path from 'path';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

router.post('/', upload.single('file'), async (req: Request, res: Response): Promise<any> => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`[Upload] Processing file: ${file.originalname} (${file.mimetype})`);

    // 1. Upload to Supabase Storage
    const fileExt = path.extname(file.originalname);
    const fileName = `${uuidv4()}${fileExt}`;
    const filePath = `${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (uploadError) {
      console.error('[Upload] Supabase storage error:', uploadError);
      return res.status(500).json({ error: 'Failed to upload file to storage' });
    }

    const { data: publicUrlData } = supabase.storage
      .from('uploads')
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData.publicUrl;
    let extractedText = '';

    // 2. Parse file for text
    try {
      if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
        // OCR using Gemini for Images and PDFs
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.warn('[Upload] GEMINI_API_KEY is not set. Skipping OCR/PDF extraction.');
        } else {
            const genAI = new GoogleGenerativeAI(apiKey);
            // Use gemini-2.5-flash for fast OCR as configured
            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
            
            const prompt = "Extract all text from this file exactly as written. If there is no text, just say NO_TEXT.";
            const imagePart = {
                inlineData: {
                    data: file.buffer.toString("base64"),
                    mimeType: file.mimetype
                },
            };
            
            const result = await model.generateContent([prompt, imagePart]);
            const response = await result.response;
            const text = response.text().trim();
            if (text !== 'NO_TEXT') {
                extractedText = text;
            }
        }
      } else if (
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.mimetype === 'application/msword'
      ) {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        extractedText = result.value;
      } else {
        // Fallback for plain text or unknown
        extractedText = file.buffer.toString('utf8');
      }
    } catch (parseError) {
      console.error('[Upload] Failed to extract text:', parseError);
      // We don't fail the whole request, just leave extractedText empty
    }

    // Determine type for frontend node
    const type = file.mimetype.startsWith('image/') ? 'image' : 'file';

    return res.json({
      url: publicUrl,
      title: file.originalname,
      content: extractedText,
      type
    });

  } catch (error) {
    console.error('[Upload] Error:', error);
    return res.status(500).json({ error: 'Internal server error during upload' });
  }
});

export default router;
