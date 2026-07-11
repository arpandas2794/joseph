import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testGeminiPDF() {
  const apiKey = process.env.GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(apiKey!);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  
  const pdfBuffer = Buffer.from(
    '%PDF-1.4\n' +
    '1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n' +
    '2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n' +
    '3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R>> endobj\n' +
    '4 0 obj <</Length 21>> stream\nBT /F1 12 Tf 0 0 Td (Hello World) Tj ET\nendstream endobj\n' +
    'xref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000056 00000 n \n0000000111 00000 n \n0000000194 00000 n \n' +
    'trailer <</Size 5 /Root 1 0 R>>\nstartxref\n266\n%%EOF',
    'utf8'
  );

  try {
    const prompt = "Extract all text from this document.";
    const pdfPart = {
        inlineData: {
            data: pdfBuffer.toString("base64"),
            mimeType: "application/pdf"
        },
    };
    const result = await model.generateContent([prompt, pdfPart]);
    const response = await result.response;
    console.log('Result:', response.text());
  } catch (error) {
    console.error('Error:', error);
  }
}

testGeminiPDF();
