import { YoutubeTranscript } from 'youtube-transcript';
async function run() {
  try {
    const transcriptItems = await YoutubeTranscript.fetchTranscript('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    console.log("Length:", transcriptItems.length);
  } catch(e) {
    console.error(e);
  }
}
run();
