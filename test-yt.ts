import { YoutubeTranscript } from 'youtube-transcript';
async function run() {
  try {
    const transcriptItems = await YoutubeTranscript.fetchTranscript('https://www.youtube.com/watch?v=NORWAY'); // wait, the url is cut off in the screenshot
  } catch(e) {
    console.error(e.message);
  }
}
