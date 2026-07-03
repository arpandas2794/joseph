const fs = require('fs');
let api = fs.readFileSync('src/lib/api.ts', 'utf-8');

const apiExtractLinkStart = api.indexOf('async extractLink(url: string, passcode?: string) {');
const apiExtractLinkEnd = api.indexOf('async uploadVoiceToStorage(');

const newExtractLink = `async extractLink(url: string, passcode?: string, onEvent?: (event: any) => void) {
    const response = await fetch('http://localhost:3001/api/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url, passcode })
    });
    
    if (!response.ok) {
      throw new Error('Failed to extract link');
    }

    if (!onEvent) {
      return response.json();
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let finalData = null;

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\\n\\n');
        
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const parts = line.split('\\ndata: ');
            if (parts.length === 2) {
              const eventType = parts[0].replace('event: ', '');
              try {
                const eventData = JSON.parse(parts[1]);
                onEvent({ type: eventType, data: eventData });
                if (eventType === 'complete') {
                  finalData = eventData;
                }
              } catch (e) {
                console.error('Failed to parse SSE JSON', e, parts[1]);
              }
            }
          }
        }
      }
    }
    
    if (!finalData) {
      throw new Error('Streaming failed to return complete data');
    }
    
    return finalData;
  },

  `;

api = api.slice(0, apiExtractLinkStart) + newExtractLink + api.slice(apiExtractLinkEnd);
fs.writeFileSync('src/lib/api.ts', api);
