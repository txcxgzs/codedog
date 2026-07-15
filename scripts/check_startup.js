const path = require("path");
process.env.NODE_ENV = "development";
process.env.DB_TYPE = "sqlite";
process.env.DB_PATH = path.join(require("os").tmpdir(), "codedog_startup_check.sqlite");
process.env.JWT_SECRET = "startup-check-jwt-secret-0123456789abcdef012345678";
process.env.SESSION_SECRET = "startup-check-session-secret-0123456789abcdef0123";
process.env.CORS_ORIGIN = "http://127.0.0.1:8080";
process.env.HCAPTCHA_ENABLED = "false";
process.env.GEETEST_ENABLED = "false";

(async () => {
  const { sequelize, OperationLog } = require(path.join(__dirname, "..", "server", "models"));
  await sequelize.sync({ force: true });
  const tables = await sequelize.getQueryInterface().showAllTables();
  console.log("audit_table_present:", tables.indexOf("developer_app_audit_logs") >= 0);
  console.log("operationlog_table_present:", tables.indexOf("operation_logs") >= 0);

  const logger = require(path.join(__dirname, "..", "server", "services", "developerApiLogger")).getDeveloperApiLogger(require(path.join(__dirname, "..", "server", "models")));
  logger.log({ user_id: 1, action: "developer_api_call", target_type: "developer_app", target_id: 1, details: JSON.stringify({ method: "GET", path: "/api/open/v1/me", status: 200 }) });
  await new Promise(r => setTimeout(r, 6000));
  const count = await OperationLog.count({ where: { action: "developer_api_call" } });
  console.log("buffered_logs_written:", count);

  await sequelize.close();
})().catch(err => { console.error("ERROR", err.message); process.exit(1); });