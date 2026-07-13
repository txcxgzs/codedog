const { createRateLimiter } = require("./rateLimit");
const { getDeveloperApiLogger } = require("../services/developerApiLogger");

const DEFAULT_RATE_LIMIT_PER_MIN = 60;
const AUTH_FAIL_MAX = Number(process.env.DEVELOPER_AUTH_FAIL_MAX || 20);
const AUTH_FAIL_WINDOW_MS = Number(process.env.DEVELOPER_AUTH_FAIL_WINDOW || 15 * 60 * 1000);

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
  const cache = new Map();
  const ttlMs = 60 * 1000;
  return async (req, res, next) => {
    try {
      const appId = req.oauth && req.oauth.appId;
      if (!appId) return next();
      let limit = cache.get(appId);
      if (!limit || limit.expiresAt < Date.now()) {
        const app = await models.DeveloperApp.findByPk(appId, { attributes: ["rate_limit_per_min"] });
        limit = { max: (app && app.rate_limit_per_min) || DEFAULT_RATE_LIMIT_PER_MIN, expiresAt: Date.now() + ttlMs };
        cache.set(appId, limit);
      }
      const limiter = createRateLimiter({
        windowMs: 60 * 1000,
        max: limit.max,
        keyPrefix: "open-api-app",
        keyGenerator: (r) => {
          const id = r.oauth && r.oauth.appId;
          const ip = r.ip || r.socket && r.socket.remoteAddress || "unknown";
          return id + ":" + ip;
        }
      });
      return limiter(req, res, next);
    } catch (err) {
      return next();
    }
  };
}

function failLogMiddleware(models) {
  const logger = getDeveloperApiLogger(models);
  return (req, res, next) => {
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
            ip: req.ip || req.socket && req.socket.remoteAddress || "unknown"
          }),
          ip_address: req.ip || req.socket && req.socket.remoteAddress || "unknown",
          user_agent: req.headers["user-agent"] || null
        });
      }
    });
    next();
  };
}

module.exports = { perAppRateLimiter, authFailLimiter, failLogMiddleware, DEFAULT_RATE_LIMIT_PER_MIN };