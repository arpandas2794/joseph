import re

with open('src/routes/extractor.ts', 'r') as f:
    content = f.read()

# 1. Update imports
content = content.replace("import { YoutubeTranscript } from 'youtube-transcript';", "import { YoutubeTranscript } from '@danielxceron/youtube-transcript';\nimport os from 'os';")

# 2. Add cleanVTT function
cleanVTT_code = """function cleanVTT(content: string): string {
    const lines = content.split('\\n');
    const cleaned = lines
        .filter(line =>
            !line.startsWith('WEBVTT') &&
            !line.includes('-->') &&
            line.trim().length > 0 &&
            isNaN(Number(line.trim()))
        )
        .map(line => line.replace(/<[^>]*>/g, '').trim());
    return cleaned.join(' ');
}

async function runYtdlpWithCookies(args: string, url: string): Promise<string> {"""
content = content.replace("async function runYtdlpWithCookies(args: string, url: string): Promise<string> {", cleanVTT_code)

# 3. Replace the huge try/catch block with the Virolo logic
# We can find the start and end tokens
start_token = "      let transcriptText = '';\n      const prefix = isLoom ? 'loom' : 'yt';\n      const tempAudioPath = req.file ? req.file.path : path.join(TEMP_DIR, `${prefix}-${Date.now()}.mp3`);"
end_token = "      if (fs.existsSync(tempAudioPath)) {\n        fs.unlinkSync(tempAudioPath);\n      }"

virolo_logic = """      let transcriptText = '';
      const tempId = `yt_${Date.now()}_${Math.floor(Math.random()*1000)}`;
      const outputTemplate = path.join(TEMP_DIR, `${tempId}.%(ext)s`);

      try {
        console.log(`[YouTubeTranscript] Fetching transcript via youtube-transcript...`);
        const transcriptItems = await YoutubeTranscript.fetchTranscript(url);
        if (transcriptItems && transcriptItems.length > 0) {
            transcriptText = transcriptItems.map((i: any) => i.text).join(' ');
            console.log(`[YouTubeTranscript] youtube-transcript success.`);
        }
      } catch (error: any) {
        console.warn(`[YouTubeTranscript] youtube-transcript failed: ${error.message}`);
      }

      if (!transcriptText && isYoutube) {
        let subPath = '';
        try {
            console.log(`[YouTubeTranscript] Fetching subs via yt-dlp...`);
            
            const args = [
                url,
                '--ignore-no-formats-error',
                '--write-auto-subs',
                '--write-subs',
                '--sub-lang', 'en',
                '--skip-download',
                '--convert-subs', 'vtt',
                '-o', outputTemplate,
                '--no-check-certificates',
                '--no-warnings',
                '--extractor-args', 'youtubetab:skip=authcheck',
                '--user-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ];

            const cookiesPath = fs.existsSync('/etc/secrets/cookies.txt') ? '/etc/secrets/cookies.txt' : path.join(__dirname, '../../cookies.txt');
            if (fs.existsSync(cookiesPath)) {
                args.push('--cookies', cookiesPath);
            }

            await execAsync(`"${YTDLP_PATH}" ${args.map(a => `"${a}"`).join(' ')}`);

            const files = fs.readdirSync(TEMP_DIR);
            const subFile = files.find(f => f.startsWith(tempId) && f.endsWith('.vtt'));

            if (subFile) {
                console.log(`[YouTubeTranscript] yt-dlp success.`);
                subPath = path.join(TEMP_DIR, subFile);
                const subContent = fs.readFileSync(subPath, 'utf-8');
                transcriptText = cleanVTT(subContent);
            }
        } catch (error: any) {
            console.warn(`[YouTubeTranscript] yt-dlp failed: ${error.message.split('\\n')[0]}...`);
        } finally {
            if (subPath && fs.existsSync(subPath)) {
                try { fs.unlinkSync(subPath); } catch (e) { }
            }
        }
      }

      if (!transcriptText || transcriptText.trim() === '') {
        transcriptText = '[No audio extracted, and no closed captions available]';
      }"""

# Slice out the old block
start_idx = content.find(start_token)
end_idx = content.find(end_token) + len(end_token)

if start_idx == -1 or end_idx < start_idx:
    print("Could not find block to replace.")
    exit(1)

content = content[:start_idx] + virolo_logic + content[end_idx:]

with open('src/routes/extractor.ts', 'w') as f:
    f.write(content)

print("Patch applied successfully.")
