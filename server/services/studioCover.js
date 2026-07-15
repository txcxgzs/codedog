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

function escapeXml(value) {
  return String(value).replace(/[<>&"']/g, (char) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;'
  }[char]));
}

function fitStudioName(value) {
  const name = String(value || '工作室').trim() || '工作室';
  const chars = [...name];
  return chars.length > 14 ? `${chars.slice(0, 13).join('')}…` : name;
}

function renderBlueArchiveStyleName(name, fontSize) {
  const safeName = escapeXml(name);
  return `<g aria-label="rare-blue-archive-style">
    <ellipse cx="640" cy="330" rx="74" ry="27" fill="none" stroke="#36c5f0" stroke-width="7" opacity=".9" transform="rotate(-22 640 330)"/>
    <g transform="skewX(-10)">
      <text x="640" y="330" text-anchor="middle" dominant-baseline="middle" fill="#128afa" font-size="${fontSize}" font-weight="800" letter-spacing="3" font-family="Noto Sans CJK SC, Microsoft YaHei, PingFang SC, sans-serif" clip-path="url(#ba-left)">${safeName}</text>
      <text x="640" y="330" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" stroke="#263549" stroke-width="2" paint-order="stroke" font-size="${fontSize}" font-weight="800" letter-spacing="3" font-family="Noto Sans CJK SC, Microsoft YaHei, PingFang SC, sans-serif" clip-path="url(#ba-right)">${safeName}</text>
    </g>
    <path d="M640 291L649 319L677 328L649 337L640 365L631 337L603 328L631 319Z" fill="#fff" stroke="#36c5f0" stroke-width="4"/>
  </g>`;
}

async function createStudioCoverBuffer(studio) {
  const name = String(studio?.name || 'Studio').trim();
  const displayName = fitStudioName(name);
  const nameLength = [...displayName].length;
  const nameSize = nameLength > 10 ? 34 : nameLength > 7 ? 39 : 46;
  const hash = crypto.createHash('sha256').update(`${studio?.id || ''}:${name}`).digest();
  const isBlueArchiveStyle = hash[1] % 20 === 0;
  const [from, to] = palettes[hash[0] % palettes.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="440" viewBox="0 0 1280 440">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>
    <clipPath id="ba-left"><rect x="0" y="265" width="640" height="135"/></clipPath><clipPath id="ba-right"><rect x="640" y="265" width="640" height="135"/></clipPath>
    <pattern id="p" width="54" height="54" patternUnits="userSpaceOnUse"><circle cx="8" cy="8" r="3" fill="#fff" opacity=".18"/><path d="M0 46L46 0" stroke="#fff" opacity=".06"/></pattern></defs>
    <rect width="1280" height="440" fill="url(#g)"/><rect width="1280" height="440" fill="url(#p)"/>
    <circle cx="1110" cy="50" r="250" fill="#fff" opacity=".09"/><circle cx="150" cy="400" r="180" fill="#fff" opacity=".06"/>
    ${renderPixelText('STUDIO', 640, 104, 18, 0.98)}
    <rect x="535" y="260" width="210" height="4" rx="2" fill="#fff" opacity=".32"/>
    ${isBlueArchiveStyle
      ? renderBlueArchiveStyleName(displayName, nameSize)
      : `<text x="640" y="330" text-anchor="middle" dominant-baseline="middle" fill="#fff" opacity=".82" font-size="${nameSize}" font-weight="700" letter-spacing="3" font-family="Noto Sans CJK SC, Microsoft YaHei, PingFang SC, sans-serif">${escapeXml(displayName)}</text>`}
  </svg>`;
  return sharp(Buffer.from(svg)).png({ quality: 92, compressionLevel: 9 }).toBuffer();
}

async function generateAndUploadStudioCover(studio) {
  const buffer = await createStudioCoverBuffer(studio);
  const url = await uploadBufferToImageHost(buffer, `studio-${studio?.id || 'new'}-v5.png`, 'image/png');
  return `${url}#codedog-studio-v5`;
}

module.exports = { createStudioCoverBuffer, generateAndUploadStudioCover };
