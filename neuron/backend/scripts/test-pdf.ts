import fs from 'fs';
import path from 'path';
const pdfParse = require('pdf-parse');
import mammoth from 'mammoth';

async function testExtract() {
  console.log('Testing extraction...');
  
  // Create a minimal valid PDF buffer in memory
  // A minimal valid PDF:
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
    const { PDFParse } = require('pdf-parse');
    const parser = new PDFParse({ data: pdfBuffer });
    const pdfData = await parser.getText();
    await parser.destroy();
    console.log('PDF Extracted Text:', pdfData.text);
  } catch (err) {
    console.error('PDF Parse Error:', err);
  }

  // DOCX is a zipped XML format, so creating a valid one manually is hard.
  // We can just log if mammoth is loaded correctly.
  console.log('Mammoth loaded:', !!mammoth.extractRawText);
}

testExtract();
