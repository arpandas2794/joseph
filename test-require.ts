try {
  const { YoutubeTranscript } = require('youtube-transcript');
  console.log(typeof YoutubeTranscript.fetchTranscript);
} catch (e) {
  console.error(e);
}
