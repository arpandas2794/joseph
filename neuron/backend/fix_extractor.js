const fs = require('fs');
let code = fs.readFileSync('src/routes/extractor.ts', 'utf-8');

// Add os import
if (!code.includes("import os from 'os';")) {
  code = code.replace("import path from 'path';", "import path from 'path';\nimport os from 'os';");
}

// Add the missing helper functions right before router.post
const helpers = `
async function fetchSocialMediaMetadataApify(url: string, isInstagram: boolean): Promise<any> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error('APIFY_API_TOKEN is not set');

  const actorId = isInstagram ? 'apify/instagram-scraper' : 'clockwork/tiktok-scraper';
  
  const input = isInstagram 
    ? { directUrls: [url], resultsType: 'details' }
    : { urls: [url] };

  console.log(\`Starting Apify \${isInstagram ? 'Instagram' : 'TikTok'} scraping...\`);
  
  // Run Apify actor
  const runRes = await axios.post(\`https://api.apify.com/v2/acts/\${actorId}/runs?token=\${token}\`, input);
  const runId = runRes.data.data.id;
  const datasetId = runRes.data.data.defaultDatasetId;

  // Poll for completion
  let finished = false;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const statusRes = await axios.get(\`https://api.apify.com/v2/acts/\${actorId}/runs/\${runId}?token=\${token}\`);
    const status = statusRes.data.data.status;
    
    if (status === 'SUCCEEDED') {
      finished = true;
      break;
    } else if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) {
      throw new Error(\`Apify run failed with status: \${status}\`);
    }
  }

  if (!finished) throw new Error('Apify scraping timed out');

  const datasetRes = await axios.get(\`https://api.apify.com/v2/datasets/\${datasetId}/items?token=\${token}\`);
  const items = datasetRes.data || [];
  const item = items[0];

  if (!item) return null;

  if (isInstagram) {
    const images: string[] = item.images || [];
    const isCarousel = images.length > 1;
    return {
      thumbnail: item.displayUrl || item.thumbnailUrl,
      title: item.caption || (isCarousel ? 'Instagram Carousel' : 'Instagram Reel'),
      channel: item.ownerUsername || 'Instagram Creator',
    };
  } else {
    return {
      thumbnail: item.coverUrl || item.dynamicCover,
      title: item.desc || 'TikTok Video',
      channel: item.author?.uniqueId || 'TikTok Creator',
    };
  }
}

async function extractWebsiteMetadata(url: string): Promise<any> {
  try {
    const htmlRes = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(htmlRes.data);
    const title = $('title').text() || $('meta[property="og:title"]').attr('content') || '';
    const description = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
    const image = $('meta[property="og:image"]').attr('content') || '';
    
    // Extract main text content
    $('script, style, nav, footer, header').remove();
    const content = $('body').text().replace(/\\s+/g, ' ').trim();
    
    return { title, description, image, content };
  } catch (err) {
    return null;
  }
}
`;

code = code.replace("router.post('/extract'", helpers + "\nrouter.post('/extract'");

fs.writeFileSync('src/routes/extractor.ts', code);
console.log('Fixed');
