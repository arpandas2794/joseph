import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testOCR() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error('No API key');
    return;
  }
  
  const groq = new Groq({ apiKey });
  
  try {
    const base64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    
    console.log('Sending to Groq...');
    const completion = await groq.chat.completions.create({
      messages: [{
        role: "user",
        content: [
          { type: "text", text: "Extract all text from this image exactly as written. If there is no text, just say NO_TEXT." },
          { type: "image_url", image_url: { url: `data:image/png;base64,${base64Image}` } }
        ]
      }],
      model: "llama-3.2-90b-vision-preview"
    });
    
    console.log('Result:', completion.choices[0]?.message?.content);
  } catch (error) {
    console.error('Error:', error);
  }
}

testOCR();
