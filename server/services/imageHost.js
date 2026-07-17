const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const IMAGE_HOST_URL = process.env.IMAGE_HOST_URL || 'https://img.scdn.io/api/v1.php';
const IMAGE_HOST_TIMEOUT_MS = Math.max(10000, Number(process.env.IMAGE_HOST_TIMEOUT_MS) || 45000);
const IMAGE_HOST_ATTEMPTS = Math.max(1, Math.min(3, Number(process.env.IMAGE_HOST_ATTEMPTS) || 2));
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

function createForm(image, options) {
  const form = new FormData();
  form.append('image', image, options);
  form.append('cdn_domain', 'img.scdn.io');
  form.append('storage_destination', 'telegram');
  return form;
}

function shouldRetry(error) {
  if (!error.response) return true;
  return error.response.status === 408 || error.response.status === 429 || error.response.status >= 500;
}

async function postImageForm(createUploadForm) {
  let lastError;
  for (let attempt = 1; attempt <= IMAGE_HOST_ATTEMPTS; attempt += 1) {
    const form = createUploadForm();
    try {
      const response = await axios.post(IMAGE_HOST_URL, form, {
        headers: form.getHeaders(),
        maxContentLength: MAX_IMAGE_SIZE,
        maxBodyLength: MAX_IMAGE_SIZE,
        timeout: IMAGE_HOST_TIMEOUT_MS,
        // 部署环境常见只有 IPv4 出口；避免 DNS 优先选中不可达的 IPv6 后一直等待超时。
        family: 4
      });
      const url = response.data?.url || response.data?.data?.url;
      if (!url) throw new Error(response.data?.message || response.data?.error || '图床未返回图片地址');
      return url;
    } catch (error) {
      lastError = error;
      if (attempt >= IMAGE_HOST_ATTEMPTS || !shouldRetry(error)) break;
      console.warn(`[图床] 第 ${attempt} 次上传失败，准备重试: ${error.code || error.message}`);
    }
  }

  const reason = lastError?.code === 'ECONNABORTED'
    ? `图床上传超时（已尝试 ${IMAGE_HOST_ATTEMPTS} 次）`
    : (lastError?.response?.data?.message || lastError?.message || '图床上传失败');
  const error = new Error(reason);
  error.cause = lastError;
  throw error;
}

async function uploadToImageHost(file) {
  // 每次重试都重新创建文件流；已失败请求中的流不能再次复用。
  return postImageForm(() => createForm(
    fs.createReadStream(file.path),
    { filename: file.originalname || 'upload', contentType: file.mimetype }
  ));
}

async function uploadBufferToImageHost(buffer, filename = 'generated.png', mimetype = 'image/png') {
  return postImageForm(() => createForm(
    buffer,
    { filename, contentType: mimetype, knownLength: buffer.length }
  ));
}

module.exports = { uploadToImageHost, uploadBufferToImageHost };
