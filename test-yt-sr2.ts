import YouTube from 'youtube-sr';
async function run() {
  const ytLib = (YouTube as any).default || YouTube;
  try {
    const videoInfo = await ytLib.getVideo('https://youtu.be/dQw4w9WgXcQ?si=xyzzzz');
    console.log(videoInfo?.title);
  } catch(e) {
    console.error(e);
  }
}
run();
