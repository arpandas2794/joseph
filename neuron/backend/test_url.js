const urls = [
  'https://www.instagram.com/reel/XYZ/',
  'https://instagram.com/p/XYZ',
  'https://instagr.am/p/XYZ',
  'HTTPS://INSTAGRAM.COM/REEL/XYZ',
  'instagram.com/reel/XYZ',
  'https://ig.me/XYZ'
];

urls.forEach(url => {
  const isInsta = url.includes('instagram.com');
  console.log(`${url} -> ${isInsta}`);
});
