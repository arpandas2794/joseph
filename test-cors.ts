import axios from 'axios';
async function run() {
  try {
    const res = await axios.get('https://api.allorigins.win/get?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ', { timeout: 10000 });
    const html = res.data.contents;
    console.log("HTML length:", html.length);
  } catch(e) {
    console.log(e.message);
  }
}
run();
