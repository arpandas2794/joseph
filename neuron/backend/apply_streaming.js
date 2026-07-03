const fs = require('fs');
let extractor = fs.readFileSync('src/routes/extractor.ts', 'utf-8');

// 1. Update transcribeAudioWithGemini signature
extractor = extractor.replace(
  `async function transcribeAudioWithGemini(audioPath: string): Promise<string> {`,
  `async function transcribeAudioWithGemini(audioPath: string, onChunk?: (chunk: string) => void): Promise<string> {`
);

// 2. Update Gemini generateContent to generateContentStream
extractor = extractor.replace(
  `const result = await model.generateContent([
      {
        fileData: {
          mimeType: uploadResponse.file.mimeType,
          fileUri: uploadResponse.file.uri
        }
      },
      { text: prompt },
    ]);

    const transcript = result.response.text();`,
  `const result = await model.generateContentStream([
      {
        fileData: {
          mimeType: uploadResponse.file.mimeType,
          fileUri: uploadResponse.file.uri
        }
      },
      { text: prompt },
    ]);

    let transcript = '';
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      transcript += chunkText;
      if (onChunk) {
        onChunk(chunkText);
      }
    }`
);

// 3. Rewrite router.post('/extract')
const routerPostStart = extractor.indexOf(`router.post('/extract'`);
extractor = extractor.slice(0, routerPostStart);

const newRouterPost = `router.post('/extract', async (req: Request, res: Response) => {
  const { url, passcode } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  res.flushHeaders();

  const sendEvent = (type: string, data: any) => {
    res.write(\`event: \${type}\\ndata: \${JSON.stringify(data)}\\n\\n\`);
  };

  const sendStatus = (status: string) => sendEvent('status', { status });
  const sendChunk = (text: string) => sendEvent('chunk', { text });
  const sendError = (error: string) => {
    sendEvent('error', { error });
    res.end();
  };
  const sendComplete = (data: any) => {
    sendEvent('complete', data);
    res.end();
  };

  try {
    const isYoutube = url.includes('youtube.com') || url.includes('youtu.be');
    const isInstagram = url.includes('instagram.com');
    const isTikTok = url.includes('tiktok.com');
    const isGoogleDocs = url.includes('docs.google.com/document');
    const isGoogleSheets = url.includes('docs.google.com/spreadsheets');
    const isZoom = url.includes('zoom.us/rec/share/') || url.includes('zoom.us/rec/play/');

    // --- 0. Zoom Meeting Extraction ---
    if (isZoom) {
      sendStatus('Extracting Zoom metadata...');
      const videoId = url.split('/').pop()?.split('?')[0] || 'zoom_meeting';
      
      sendEvent('metadata', {
        type: 'zoom',
        metadata: {
          videoId,
          title: 'Zoom Recording',
          channel: 'Zoom Meeting',
        }
      });

      sendStatus('Downloading Zoom audio...');
      const tempAudioPath = path.join(os.tmpdir(), \`zoom-\${Date.now()}.mp3\`);
      
      let ytDlpArgs = \`-x --audio-format mp3 -o "\${tempAudioPath}"\`;
      if (passcode) {
        ytDlpArgs += \` --video-password "\${passcode}"\`;
      }
      
      try {
        await runYtdlpWithCookies(ytDlpArgs, url);
        
        sendStatus('Transcribing audio with Gemini...');
        let fullTranscript = '';
        await transcribeAudioWithGemini(tempAudioPath, (chunk) => {
          fullTranscript += chunk;
          sendChunk(chunk);
        });
        
        return sendComplete({
          type: 'zoom',
          metadata: { title: 'Zoom Recording', channel: 'Zoom Meeting', videoId },
          content: fullTranscript
        });
      } catch (err: any) {
        return sendError('Failed to process Zoom recording: ' + err.message);
      }
    }

    // --- 1. Google Drive Extraction ---
    if (isGoogleDocs || isGoogleSheets) {
      sendStatus('Extracting Google Drive content...');
      let documentId = '';
      const match = url.match(/\\/d\\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        documentId = match[1];
      } else {
        return sendError('Invalid Google Drive URL format.');
      }

      const isDoc = isGoogleDocs;
      const exportFormat = isDoc ? 'txt' : 'csv';
      const exportUrl = \`https://docs.google.com/\${isDoc ? 'document' : 'spreadsheets'}/d/\${documentId}/export?format=\${exportFormat}\`;

      try {
        const response = await axios.get(exportUrl, { responseType: 'text' });
        const text = response.data;
        let title = isDoc ? 'Google Doc' : 'Google Sheet';
        try {
          const htmlRes = await axios.get(url);
          const $ = cheerio.load(htmlRes.data);
          const pageTitle = $('title').text();
          if (pageTitle) title = pageTitle.replace(' - Google Docs', '').replace(' - Google Sheets', '').trim();
        } catch (e) {}

        return sendComplete({
          type: 'google_drive',
          metadata: { title, url, documentType: isDoc ? 'document' : 'spreadsheet' },
          content: text
        });
      } catch (err: any) {
        return sendError('Google Drive extraction failed: ' + err.message);
      }
    }

    // --- 2. YouTube Extraction ---
    if (isYoutube) {
      sendStatus('Extracting YouTube metadata...');
      const metaStdout = await runYtdlpWithCookies('--dump-json --no-playlist', url);
      const metadata = JSON.parse(metaStdout);
      const videoId = metadata.id;
      const title = metadata.title;
      const channel = metadata.uploader;

      sendEvent('metadata', {
        type: 'youtube',
        metadata: { title, channel, videoId }
      });

      sendStatus('Downloading YouTube audio...');
      const tempAudioPath = path.join(os.tmpdir(), \`yt-\${Date.now()}.mp3\`);
      await runYtdlpWithCookies(\`-x --audio-format mp3 -o "\${tempAudioPath}"\`, url);

      sendStatus('Transcribing audio...');
      let fullTranscript = '';
      await transcribeAudioWithGemini(tempAudioPath, (chunk) => {
        fullTranscript += chunk;
        sendChunk(chunk);
      });

      return sendComplete({
        type: 'youtube',
        metadata: { title, channel, videoId },
        content: fullTranscript
      });
    }

    // --- 3. Social Media (Instagram/TikTok) Extraction ---
    if (isInstagram || isTikTok) {
      sendStatus('Extracting metadata from Apify...');
      const apifyMetadata = await fetchSocialMediaMetadataApify(url, isInstagram);
      
      let thumbnail = '';
      let title = isInstagram ? 'Instagram Post' : 'TikTok Video';
      let channel = '';
      
      if (apifyMetadata) {
        thumbnail = apifyMetadata.thumbnail || '';
        title = apifyMetadata.title || title;
        channel = apifyMetadata.channel || '';
      }

      sendEvent('metadata', {
        type: isInstagram ? 'instagram' : 'tiktok',
        metadata: { title, channel, thumbnail }
      });

      sendStatus('Downloading media audio...');
      const tempAudioPath = path.join(os.tmpdir(), \`social-\${Date.now()}.mp3\`);
      await runYtdlpWithCookies(\`-x --audio-format mp3 -o "\${tempAudioPath}"\`, url);

      sendStatus('Transcribing audio...');
      let fullTranscript = '';
      await transcribeAudioWithGemini(tempAudioPath, (chunk) => {
        fullTranscript += chunk;
        sendChunk(chunk);
      });

      return sendComplete({
        type: isInstagram ? 'instagram' : 'tiktok',
        metadata: { title, channel, thumbnail },
        content: fullTranscript
      });
    }

    // --- 4. Fallback: Generic Website Scraper ---
    sendStatus('Scraping website content...');
    const result = await extractWebsiteMetadata(url);
    if (!result) {
      return sendError('Failed to extract content from URL');
    }

    return sendComplete({
      type: 'website',
      metadata: {
        title: result.title || 'Untitled',
        description: result.description || '',
        thumbnail: result.image || '',
        url: url
      },
      content: result.content
    });

  } catch (error: any) {
    console.error('Extraction error:', error.message);
    return sendError(\`Failed to extract content: \${error.message}\`);
  }
});
export default router;
`;

extractor += newRouterPost;
fs.writeFileSync('src/routes/extractor.ts', extractor);
