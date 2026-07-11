import YouTube from 'youtube-sr';
async function run() {
  const ytLib = (YouTube as any).default || YouTube;
  try {
    const videoInfo = await ytLib.getVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    console.log(videoInfo);
  } catch(e) {
    console.error(e);
  }
}
run();
