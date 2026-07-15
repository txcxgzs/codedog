const fs = require("fs");
const b64 = fs.readFileSync("scripts/admin_block.b64", "utf8").trim();
const adminBlock = Buffer.from(b64, "base64").toString("utf8");

const file = "server/controllers/developerController.js";
const raw = fs.readFileSync(file, "utf8");

const marker = "// -------- OAuth --------";
const idx = raw.indexOf(marker);
if (idx === -1 || idx !== raw.lastIndexOf(marker)) { console.error("MARKER problem"); process.exit(1); }

let out = raw.slice(0, idx) + adminBlock + "\n" + raw.slice(idx);

const reviewNeedle = "logOperation(req, 'review_developer_app', 'developer_app', app.id, { action, note });";
if (!out.includes(reviewNeedle)) { console.error("reviewNeedle NOT FOUND"); process.exit(1); }
out = out.replace(reviewNeedle, reviewNeedle + "\r\n        await recordAppAudit(app.id, getOwnerId(req), { action: 'review_' + action, fromStatus: app.status, toStatus: map[action], reviewNote: note != null ? String(note).trim() : null });");

const statsNeedle = "stats: { authorizationCount, activeAuthorizationCount, accessTokenCount, activeAccessTokenCount, callCount }";
if (!out.includes(statsNeedle)) { console.error("statsNeedle NOT FOUND"); process.exit(1); }
out = out.replace(statsNeedle, "stats: { authorizationCount, activeAuthorizationCount, accessTokenCount, activeAccessTokenCount, callCount, auditCount: 0 }");

const exportsMarker = "openReviewStudio\r\n};";
if (!out.includes(exportsMarker)) { console.error("exportsMarker NOT FOUND"); process.exit(1); }
const newExports = "openReviewStudio,\r\n" +
    "    adminUpdateAppRateLimit,\r\n" +
    "    adminRevokeAllTokens,\r\n" +
    "    adminRegenerateSecret,\r\n" +
    "    adminDeleteApp,\r\n" +
    "    adminListAuditLogs,\r\n" +
    "    adminCallLogStats,\r\n" +
    "    adminCallLogStatsDetail,\r\n};";
out = out.replace(exportsMarker, newExports);

fs.writeFileSync(file, out, "utf8");
console.log("OK injected=" + adminBlock.length + " total=" + out.length);
