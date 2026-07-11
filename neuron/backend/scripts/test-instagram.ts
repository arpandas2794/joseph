import { fetchInstagramContent } from '../src/actions/instagram';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
    // Carousel post
    const url = 'https://www.instagram.com/p/DFoX6-pS-qY/';
    console.log('Testing Instagram extraction for url:', url);
    try {
        const result = await fetchInstagramContent(url, 'localhost:3001', 'http');
        console.log('Extraction successful!');
        console.log(JSON.stringify(result, null, 2));
    } catch (e: any) {
        console.error('Extraction failed:', e.message || e);
    }
}

run();
