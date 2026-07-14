const crypto = require('crypto');
const sharp = require('sharp');
const { uploadBufferToImageHost } = require('./imageHost');

const palettes = [
  ['#48d5d0', '#7187e8'], ['#ffc857', '#ff8a7a'], ['#ff8794', '#ffb58b'],
  ['#8f7ee7', '#5ec8e5'], ['#67d69a', '#4fa8dd'], ['#b889ed', '#f28fb5']
];

function escapeXml(value) {
  return String(value).replace(/[<>&"']/g, (char) => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;', "'":'&apos;' }[char]));
}

async function createStudioCoverBuffer(studio) {
  const name = String(studio?.name || '工作室').trim();
  const initial = escapeXml([...name][0] || '创');
  const hash = crypto.createHash('sha256').update(`${studio?.id || ''}:${name}`).digest();
  const [from, to] = palettes[hash[0] % palettes.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="440" viewBox="0 0 1280 440">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>
    <pattern id="p" width="54" height="54" patternUnits="userSpaceOnUse"><circle cx="8" cy="8" r="3" fill="#fff" opacity=".18"/><path d="M0 46L46 0" stroke="#fff" opacity=".06"/></pattern></defs>
    <rect width="1280" height="440" rx="0" fill="url(#g)"/><rect width="1280" height="440" fill="url(#p)"/>
    <circle cx="1110" cy="50" r="250" fill="#fff" opacity=".09"/><circle cx="150" cy="400" r="180" fill="#fff" opacity=".06"/>
    <text x="640" y="220" dy=".35em" text-anchor="middle" fill="#fff" opacity=".96" font-size="156" font-weight="800" font-family="Microsoft YaHei, PingFang SC, Noto Sans CJK SC, sans-serif">${initial}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png({ quality: 92, compressionLevel: 9 }).toBuffer();
}

async function generateAndUploadStudioCover(studio) {
  const buffer = await createStudioCoverBuffer(studio);
  return uploadBufferToImageHost(buffer, `studio-${studio?.id || 'new'}.png`, 'image/png');
}

module.exports = { createStudioCoverBuffer, generateAndUploadStudioCover };
