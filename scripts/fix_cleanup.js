const fs = require("fs");
const file = "server/services/developerApiLogger.js";
let raw = fs.readFileSync(file, "utf8");

const oldCleanup = `const deleted = await this.models.OperationLog.destroy({
      where: { action: "developer_api_call", created_at: { [Op.lt]: cutoff } }
    });`;

const newCleanup = `const deleted = await this.models.OperationLog.destroy({
      where: { action: { [Op.in]: ["developer_api_call", "developer_api_fail"] }, created_at: { [Op.lt]: cutoff } }
    });`;

if (!raw.includes(oldCleanup)) { console.error("cleanup needle not found"); process.exit(1); }
raw = raw.replace(oldCleanup, newCleanup);
fs.writeFileSync(file, raw, "utf8");
console.log("OK cleanup coverage fixed");
