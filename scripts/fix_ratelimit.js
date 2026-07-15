const fs = require("fs");
const file = "server/middleware/developerOpenApi.js";
let raw = fs.readFileSync(file, "utf8");

const startMark = "function perAppRateLimiter(models) {";
const endMark = "ttlMs = 60 * 1000;";
const startIdx = raw.indexOf(startMark);
// find the closing of the function: after endMark, find "};" followed by next function or failLogMiddleware
const afterEndMark = raw.indexOf(endMark, startIdx) + endMark.length;
// find the next top-level "function " after this
const nextFn = raw.indexOf("\nfunction ", afterEndMark);
if (startIdx === -1 || nextFn === -1) { console.error("markers not found"); process.exit(1); }

const replaced = `function perAppRateLimiter(models) {
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
}`;

raw = raw.slice(0, startIdx) + replaced + raw.slice(nextFn);
fs.writeFileSync(file, raw, "utf8");
console.log("OK perAppRateLimiter replaced, total=" + raw.length);
