const crypto = require('crypto');
const sharp = require('sharp');
const { uploadBufferToImageHost } = require('./imageHost');

const palettes = [
  ['#48d5d0', '#7187e8'], ['#ffc857', '#ff8a7a'], ['#ff8794', '#ffb58b'],
  ['#8f7ee7', '#5ec8e5'], ['#67d69a', '#4fa8dd'], ['#b889ed', '#f28fb5']
];

const pixelGlyphs = {
  S: ['11111', '10000', '10000', '11111', '00001', '00001', '11111'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '11111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  '#': ['01010', '11111', '01010', '01010', '11111', '01010', '01010'],
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  6: ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00001', '01110']
};

function renderPixelText(text, centerX, topY, scale, opacity = 1) {
  const chars = [...String(text).toUpperCase()];
  const gap = scale * 2;
  const charWidth = scale * 5;
  const width = chars.length * charWidth + Math.max(0, chars.length - 1) * gap;
  const startX = centerX - width / 2;
  const blocks = chars.map((char, charIndex) => {
    const glyph = pixelGlyphs[char] || pixelGlyphs[0];
    return glyph.flatMap((row, rowIndex) => [...row].map((cell, columnIndex) => cell === '1'
      ? `<rect x="${startX + charIndex * (charWidth + gap) + columnIndex * scale}" y="${topY + rowIndex * scale}" width="${scale}" height="${scale}" rx="${Math.max(1, scale * 0.12)}"/>`
      : '')).filter(Boolean).join('');
  }).join('');
  return `<g fill="#fff" opacity="${opacity}">${blocks}</g>`;
}

async function createStudioCoverBuffer(studio) {
  const name = String(studio?.name || 'Studio').trim();
  const studioNo = String(studio?.id || 0).padStart(3, '0');
  const hash = crypto.createHash('sha256').update(`${studio?.id || ''}:${name}`).digest();
  const [from, to] = palettes[hash[0] % palettes.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="440" viewBox="0 0 1280 440">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>
    <pattern id="p" width="54" height="54" patternUnits="userSpaceOnUse"><circle cx="8" cy="8" r="3" fill="#fff" opacity=".18"/><path d="M0 46L46 0" stroke="#fff" opacity=".06"/></pattern></defs>
    <rect width="1280" height="440" fill="url(#g)"/><rect width="1280" height="440" fill="url(#p)"/>
    <circle cx="1110" cy="50" r="250" fill="#fff" opacity=".09"/><circle cx="150" cy="400" r="180" fill="#fff" opacity=".06"/>
    ${renderPixelText('STUDIO', 640, 104, 18, 0.98)}
    <rect x="535" y="260" width="210" height="4" rx="2" fill="#fff" opacity=".32"/>
    ${renderPixelText(`#${studioNo}`, 640, 292, 9, 0.72)}
  </svg>`;
  return sharp(Buffer.from(svg)).png({ quality: 92, compressionLevel: 9 }).toBuffer();
}

async function generateAndUploadStudioCover(studio) {
  const buffer = await createStudioCoverBuffer(studio);
  const url = await uploadBufferToImageHost(buffer, `studio-${studio?.id || 'new'}-v3.png`, 'image/png');
  return `${url}#codedog-studio-v3`;
}

module.exports = { createStudioCoverBuffer, generateAndUploadStudioCover };
