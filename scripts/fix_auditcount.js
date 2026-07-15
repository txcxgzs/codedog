const fs = require("fs");
const file = "server/controllers/developerController.js";
let raw = fs.readFileSync(file, "utf8");

// Find the Promise.all block in adminGetApp and add auditCount count + the var
const oldPromise = `const [authorizationCount, activeAuthorizationCount, accessTokenCount, activeAccessTokenCount, callCount] = await Promise.all([
            DbAdapter.count(UserAppAuthorization, { where: { app_id: appId } }),
            DbAdapter.count(UserAppAuthorization, { where: { app_id: appId, revoked_at: null } }),
            DbAdapter.count(OAuthAccessToken, { where: { app_id: appId } }),
            DbAdapter.count(OAuthAccessToken, { where: { app_id: appId, revoked_at: null, expires_at: { [Op.gt]: now } } }),
            DbAdapter.count(OperationLog, { where: { action: \'developer_api_call\', target_type: \'developer_app\', target_id: appId } })
        ]);`;

const newPromise = `const [authorizationCount, activeAuthorizationCount, accessTokenCount, activeAccessTokenCount, callCount, auditCount] = await Promise.all([
            DbAdapter.count(UserAppAuthorization, { where: { app_id: appId } }),
            DbAdapter.count(UserAppAuthorization, { where: { app_id: appId, revoked_at: null } }),
            DbAdapter.count(OAuthAccessToken, { where: { app_id: appId } }),
            DbAdapter.count(OAuthAccessToken, { where: { app_id: appId, revoked_at: null, expires_at: { [Op.gt]: now } } }),
            DbAdapter.count(OperationLog, { where: { action: \'developer_api_call\', target_type: \'developer_app\', target_id: appId } }),
            DbAdapter.count(DeveloperAppAuditLog, { where: { app_id: appId } })
        ]);`;

if (!raw.includes(oldPromise)) { console.error("Promise.all needle not found"); process.exit(1); }
raw = raw.replace(oldPromise, newPromise);

// Also fix the stats object to use the real auditCount
raw = raw.replace("callCount, auditCount: 0", "callCount, auditCount");

fs.writeFileSync(file, raw, "utf8");
console.log("OK auditCount fixed");
