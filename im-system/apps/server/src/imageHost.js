const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

const endpoint = process.env.IMAGE_HOST_ENDPOINT || 'https://img.scdn.io/api/v1.php';
const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function validSignature(file) {
  const bytes = fs.readFileSync(file.path);
  if (file.mimetype === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.mimetype === 'image/png') return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  if (file.mimetype === 'image/webp') return bytes.length >= 12 && bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP';
  if (file.mimetype === 'image/gif') return ['GIF87a', 'GIF89a'].includes(bytes.subarray(0,6).toString());
  return false;
}

async function uploadImage(file) {
  if (!file || !allowed.has(file.mimetype) || !validSignature(file)) throw Object.assign(new Error('图片格式或文件签名无效'), { statusCode: 400 });
  const form = new FormData();
  form.append('image', fs.createReadStream(file.path), { filename: file.originalname || 'image', contentType: file.mimetype });
  form.append('cdn_domain', process.env.IMAGE_HOST_CDN_DOMAIN || 'img.scdn.io');
  form.append('storage_destination', process.env.IMAGE_HOST_STORAGE_DESTINATION || 'telegram');
  const response = await axios.post(endpoint, form, { headers: form.getHeaders(), timeout: 30000, maxContentLength: 5 * 1024 * 1024 });
  const url = response.data?.url || response.data?.data?.url;
  if (!url) throw Object.assign(new Error('现有图床未返回图片地址'), { statusCode: 502 });
  return url;
}

module.exports = { uploadImage };
