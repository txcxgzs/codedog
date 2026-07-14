const { createRateLimiter } = require("./rateLimit");
const { getDeveloperApiLogger } = require("../services/developerApiLogger");

const DEFAULT_RATE_LIMIT_PER_MIN = 60;
const AUTH_FAIL_MAX = Number(process.env.DEVELOPER_AUTH_FAIL_MAX || 20);
const AUTH_FAIL_WINDOW_MS = Number(process.env.DEVELOPER_AUTH_FAIL_WINDOW || 15 * 60 * 1000);
const MAX_CAPTURE_BYTES = Number(process.env.DEVELOPER_LOG_CAPTURE_BYTES || 16384);

function redact(value, depth = 0) {
  if (depth > 5) return '[MaxDepth]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value.length > MAX_CAPTURE_BYTES ? value.slice(0, MAX_CAPTURE_BYTES) + '…[truncated]' : value;
  if (Array.isArray(value)) return value.slice(0, 100).map(v => redact(v, depth + 1));
  if (typeof value !== 'object') return value;
  const out = {};
  for (const [key, val] of Object.entries(value).slice(0, 100)) {
    if (/authorization|cookie|secret|token|password|passwd|private.?key|client_secret/i.test(key)) out[key] = '[REDACTED]';
    else out[key] = redact(val, depth + 1);
  }
  return out;
}

function captureRequest(req) {
  const body = req.body && typeof req.body === 'object' ? redact(req.body) : null;
  const headers = {};
  for (const key of ['content-type', 'content-length', 'accept']) if (req.headers[key]) headers[key] = req.headers[key];
  return { headers, query: redact(req.query || {}), body };
}

function installResponseCapture(res) {
  let chunks = [];
  const originalWrite = res.write;
  const originalEnd = res.end;
  res.write = function (chunk, encoding) {
    if (chunks.join('').length < MAX_CAPTURE_BYTES && chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk.toString(encoding) : String(chunk));
    return originalWrite.apply(this, arguments);
  };
  res.end = function (chunk, encoding) {
    if (chunks.join('').length < MAX_CAPTURE_BYTES && chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk.toString(encoding) : String(chunk));
    res.__developerResponseBody = chunks.join('').slice(0, MAX_CAPTURE_BYTES);
    return originalEnd.apply(this, arguments);
  };
}

const authFailLimiter = createRateLimiter({
  windowMs: AUTH_FAIL_WINDOW_MS,
  max: AUTH_FAIL_MAX,
  keyPrefix: "developer-auth-fail",
  keyGenerator: (req) => {
    const ip = req.ip || req.socket && req.socket.remoteAddress || "unknown";
    const clientId = (req.query && req.query.client_id) || (req.body && req.body.client_id) || "unknown";
    return ip + ":" + clientId;
  }
});

function perAppRateLimiter(models) {
  const cache = new Map();      // appId -> { max, expiresAt }
  const limiters = new Map();   // appId -> { limiter, max }
  const ttlMs = 60 * 1000;
  return async (req, res, next) => {
    try {
      const appId = req.oauth && req.oauth.appId;
      if (!appId) return next();
      let entry = cache.get(appId);
      if (!entry || entry.expiresAt < Date.now()) {
        const app = await models.DeveloperApp.findByPk(appId, { attributes: ["rate_limit_per_min"] });
        entry = { max: (app && app.rate_limit_per_min) || DEFAULT_RATE_LIMIT_PER_MIN, expiresAt: Date.now() + ttlMs };
        cache.set(appId, entry);
      }
      let slot = limiters.get(appId);
      if (!slot || slot.max !== entry.max) {
        slot = {
          max: entry.max,
          limiter: createRateLimiter({
            windowMs: 60 * 1000,
            max: entry.max,
            keyPrefix: "open-api-app",
            keyGenerator: (r) => {
              const id = r.oauth && r.oauth.appId;
              const ip = r.ip || r.socket && r.socket.remoteAddress || "unknown";
              return id + ":" + ip;
            }
          })
        };
        limiters.set(appId, slot);
      }
      return slot.limiter(req, res, next);
    } catch (err) {
      return next();
    }
  };
}
function failLogMiddleware(models) {
  const logger = getDeveloperApiLogger(models);
  return (req, res, next) => {
    installResponseCapture(res);
    res.on("finish", () => {
      if (res.statusCode === 401 || res.statusCode === 403) {
        logger.log({
          user_id: null,
          action: "developer_api_fail",
          target_type: "developer_app",
          target_id: null,
          details: JSON.stringify({
            method: req.method,
            path: req.originalUrl ? req.originalUrl.split("?")[0] : req.path,
            status: res.statusCode,
            ip: req.ip || req.socket && req.socket.remoteAddress || "unknown",
            request: captureRequest(req),
            response: (() => { try { return redact(JSON.parse(res.__developerResponseBody || 'null')); } catch (_) { return (res.__developerResponseBody || '').slice(0, MAX_CAPTURE_BYTES); } })()
          }),
          ip_address: req.ip || req.socket && req.socket.remoteAddress || "unknown",
          user_agent: req.headers["user-agent"] || null
        });
      }
    });
    next();
  };
}

module.exports = { perAppRateLimiter, authFailLimiter, failLogMiddleware, DEFAULT_RATE_LIMIT_PER_MIN, captureRequest, installResponseCapture, redact };
