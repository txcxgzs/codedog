const fs = require("fs");
const path = require("path");

function deco(p){ return Buffer.from(fs.readFileSync(path.join(__dirname, p), "utf8").trim(), "base64").toString("utf8"); }

const head = deco("developer_controller_head.b64");
const tail = deco("developer_controller_tail.b64");
const middle = deco("developer_controller_middle.b64");

const exportMarker = "openReviewStudio\n};";
if (tail.indexOf(exportMarker) < 0) throw new Error("export marker not found in tail: " + JSON.stringify(tail.slice(-120)));
const newTail = tail.replace(exportMarker, `    openReviewStudio,\n    adminUpdateRateLimit,\n    adminRevokeAllTokens,\n    adminRegenerateSecret,\n    adminDeleteApp,\n    adminListAuditLogs,\n    adminCallLogStats,\n    adminCallLogStatsDetail\n};`);

const final = head + middle + newTail;
fs.writeFileSync(path.resolve(__dirname, "..", "server", "controllers", "developerController.js"), final, "utf8");
console.log("assembled controller bytes:", final.length);