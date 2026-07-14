const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function uploadToImageHost(file) {
  const form = new FormData();
  form.append('image', fs.createReadStream(file.path), { filename: file.originalname || 'upload', contentType: file.mimetype });
  form.append('cdn_domain', 'img.scdn.io');
  form.append('storage_destination', 'telegram');
  const response = await axios.post('https://img.scdn.io/api/v1.php', form, { headers: form.getHeaders(), maxContentLength: 5 * 1024 * 1024, timeout: 30000 });
  const url = response.data?.url || response.data?.data?.url;
  if (!url) throw new Error(response.data?.message || response.data?.error || '图床未返回图片地址');
  return url;
}

async function uploadBufferToImageHost(buffer, filename = 'generated.png', mimetype = 'image/png') {
  const form = new FormData();
  form.append('image', buffer, { filename, contentType: mimetype, knownLength: buffer.length });
  form.append('cdn_domain', 'img.scdn.io');
  form.append('storage_destination', 'telegram');
  const response = await axios.post('https://img.scdn.io/api/v1.php', form, {
    headers: form.getHeaders(), maxContentLength: 5 * 1024 * 1024, timeout: 30000
  });
  const url = response.data?.url || response.data?.data?.url;
  if (!url) throw new Error(response.data?.message || response.data?.error || '图床未返回图片地址');
  return url;
}

module.exports = { uploadToImageHost, uploadBufferToImageHost };
