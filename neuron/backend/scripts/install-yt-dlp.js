#!/usr/bin/env node
/**
 * Postinstall script: Downloads the correct yt-dlp standalone binary for the current platform.
 * - Linux  → yt-dlp        (fully standalone, no Python required)
 * - macOS  → yt-dlp_macos  (fully standalone, no Python required)
 *
 * This means Render (Linux) and local Mac both get the right binary automatically.
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const BIN_DIR = path.join(__dirname, '..', 'bin');
const BIN_PATH = path.join(BIN_DIR, 'yt-dlp');

const platform = process.platform;
const BINARY_URL = platform === 'darwin'
  ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos'
  : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

if (!fs.existsSync(BIN_DIR)) {
  fs.mkdirSync(BIN_DIR, { recursive: true });
}

console.log(`[install-yt-dlp] Downloading yt-dlp for platform: ${platform}`);
console.log(`[install-yt-dlp] URL: ${BINARY_URL}`);

function download(url, dest, cb) {
  https.get(url, (res) => {
    if (res.statusCode === 301 || res.statusCode === 302) {
      return download(res.headers.location, dest, cb);
    }
    if (res.statusCode !== 200) {
      return cb(new Error(`Failed to download: HTTP ${res.statusCode}`));
    }
    const file = fs.createWriteStream(dest);
    res.pipe(file);
    file.on('finish', () => file.close(cb));
    file.on('error', (err) => {
      fs.unlink(dest, () => {});
      cb(err);
    });
  }).on('error', cb);
}

download(BINARY_URL, BIN_PATH, (err) => {
  if (err) {
    console.error('[install-yt-dlp] Download failed:', err.message);
    process.exit(1);
  }
  fs.chmodSync(BIN_PATH, 0o755);
  console.log(`[install-yt-dlp] Successfully installed yt-dlp to ${BIN_PATH}`);
});
