const { YoutubeTranscript } = require('youtube-transcript');
YoutubeTranscript.fetchTranscript('https://www.youtube.com/watch?v=xBfoFijhAqw')
  .then(res => console.log('Length:', res.length, 'First line:', res[0].text))
  .catch(console.error);
