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
  const name = String(studio?.name || 'Studio').trim();
  const latinInitial = ([...name].find(char => /[a-z0-9]/i.test(char)) || 'C').toUpperCase();
  const studioNo = String(studio?.id || 0).padStart(3, '0');
  const hash = crypto.createHash('sha256').update(`${studio?.id || ''}:${name}`).digest();
  const [from, to] = palettes[hash[0] % palettes.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="440" viewBox="0 0 1280 440">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>
    <pattern id="p" width="54" height="54" patternUnits="userSpaceOnUse"><circle cx="8" cy="8" r="3" fill="#fff" opacity=".18"/><path d="M0 46L46 0" stroke="#fff" opacity=".06"/></pattern></defs>
    <rect width="1280" height="440" rx="0" fill="url(#g)"/><rect width="1280" height="440" fill="url(#p)"/>
    <circle cx="1110" cy="50" r="250" fill="#fff" opacity=".09"/><circle cx="150" cy="400" r="180" fill="#fff" opacity=".06"/>
    <text x="640" y="185" text-anchor="middle" dominant-baseline="middle" fill="#fff" opacity=".98" font-size="112" font-weight="800" letter-spacing="12" font-family="Arial, DejaVu Sans, sans-serif">${escapeXml(latinInitial)} · STUDIO</text>
    <text x="640" y="295" text-anchor="middle" dominant-baseline="middle" fill="#fff" opacity=".72" font-size="34" font-weight="700" letter-spacing="8" font-family="Arial, DejaVu Sans, sans-serif">CREATIVE SPACE · #${studioNo}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png({ quality: 92, compressionLevel: 9 }).toBuffer();
}

async function generateAndUploadStudioCover(studio) {
  const buffer = await createStudioCoverBuffer(studio);
  const url = await uploadBufferToImageHost(buffer, `studio-${studio?.id || 'new'}-v2.png`, 'image/png');
  return `${url}#codedog-studio-v2`;
}

module.exports = { createStudioCoverBuffer, generateAndUploadStudioCover };
