const fs = require("fs");
const raw = fs.readFileSync("client/src/api/admin.js", "utf8");
const idx = raw.indexOf("reviewDeveloperApp(id, data)");
// find the closing "  }," of this method
const methodEnd = raw.indexOf("},", idx);
const lineEnd = raw.indexOf("\n", methodEnd);
const insertPoint = lineEnd + 1;

const newMethods = [
  "  updateDeveloperAppRateLimit(id, rate_limit_per_min) {",
  "    return request.put(`/admin/developer-apps/${id}/rate-limit`, { rate_limit_per_min })",
  "  },",
  "  revokeAllTokens(id) {",
  "    return request.post(`/admin/developer-apps/${id}/revoke-all-tokens`)",
  "  },",
  "  regenerateSecret(id) {",
  "    return request.post(`/admin/developer-apps/${id}/regenerate-secret`)",
  "  },",
  "  deleteDeveloperApp(id) {",
  "    return request.delete(`/admin/developer-apps/${id}`)",
  "  },",
  "  getDeveloperAppAuditLogs(id, params = {}) {",
  "    return request.get(`/admin/developer-apps/${id}/audit-logs`, { params })",
  "  },",
  "  getDeveloperAppStats(id) {",
  "    return request.get(`/admin/developer-apps/${id}/stats`)",
  "  },",
  "  getDeveloperAppStatsDetail(id, params = {}) {",
  "    return request.get(`/admin/developer-apps/${id}/stats/detail`, { params })",
  "  },",
  ""
].join("\n");

const out = raw.slice(0, insertPoint) + newMethods + raw.slice(insertPoint);
fs.writeFileSync("client/src/api/admin.js", out, "utf8");
console.log("OK insertPoint=" + insertPoint + " total=" + out.length);
