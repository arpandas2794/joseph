import fs from 'fs';
import ytdl from '@distube/ytdl-core';
async function run() {
  try {
    const stream = ytdl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', { filter: 'audioonly', quality: 'highestaudio' });
    stream.pipe(fs.createWriteStream('test-audio.mp3'));
    stream.on('end', () => console.log('Audio downloaded successfully via ytdl-core!'));
    stream.on('error', (err) => console.error('ytdl-core error:', err.message));
  } catch(e) {
    console.error(e.message);
  }
}
run();
