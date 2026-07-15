const fs = require("fs");
const file = "server/routes/openRoutes.js";
let raw = fs.readFileSync(file, "utf8");

const oldFinish = `    res.on(\'finish\', function () {
        const logger = require(\'../services/developerApiLogger\').getDeveloperApiLogger(require(\'../models\'));
        logger.log({`;

const newFinish = `    res.on(\'finish\', function () {
        // Skip failed-auth responses (401/403); those are logged separately as developer_api_fail by failLogMiddleware
        if (res.statusCode === 401 || res.statusCode === 403) return;
        const logger = require(\'../services/developerApiLogger\').getDeveloperApiLogger(require(\'../models\'));
        logger.log({`;

if (!raw.includes(oldFinish)) { console.error("finish needle not found"); process.exit(1); }
raw = raw.replace(oldFinish, newFinish);
fs.writeFileSync(file, raw, "utf8");
console.log("OK double-logging fixed");
