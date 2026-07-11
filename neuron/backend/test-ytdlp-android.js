const { exec } = require('child_process');

exec('./yt-dlp -x --audio-format mp3 --extractor-args "youtube:player_client=android" -o "test-audio.mp3" "https://www.youtube.com/watch?v=xBfoFijhAqw"', { cwd: '/Users/arpan/joseph/neuron/backend' }, (err, stdout, stderr) => {
  if (err) {
     console.error('Error:', err.message);
  }
  console.log('Stdout:', stdout);
  console.log('Stderr:', stderr);
});
