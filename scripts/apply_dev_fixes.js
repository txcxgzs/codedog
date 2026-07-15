const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const NL = require("os").EOL;

function read(p){ return fs.readFileSync(path.join(root, p), "utf8"); }
function write(p, s){ fs.writeFileSync(path.join(root, p), s); console.log("wrote", p, s.length, "bytes"); }
function insertBefore(p, marker, block){
  let s = read(p);
  const idx = s.indexOf(marker);
  if (idx < 0) throw new Error("marker not found in " + p + ": " + JSON.stringify(marker.slice(0, 80)));
  s = s.slice(0, idx) + block + s.slice(idx);
  write(p, s);
}
function insertAfter(p, marker, block){
  let s = read(p);
  const idx = s.indexOf(marker);
  if (idx < 0) throw new Error("marker not found in " + p + ": " + JSON.stringify(marker.slice(0, 80)));
  s = s.slice(0, idx + marker.length) + block + s.slice(idx + marker.length);
  write(p, s);
}

const loggerSource = [
  'const { Op } = require("sequelize");',
  '',
  'const FLUSH_INTERVAL_MS = Number(process.env.DEVELOPER_LOG_FLUSH_MS || 5000);',
  'const RETENTION_DAYS = Number(process.env.DEVELOPER_LOG_RETENTION_DAYS || 90);',
  'const MAX_BUFFER = Number(process.env.DEVELOPER_LOG_MAX_BUFFER || 5000);',
  '',
  'class DeveloperApiLogger {',
  '  constructor(models) {',
  '    if (!models) throw new Error("DeveloperApiLogger requires models");',
  '    this.models = models;',
  '    this.buffer = [];',
  '    this.timer = null;',
  '    this.started = false;',
  '  }',
  '',
  '  start() {',
  '    if (this.started) return;',
  '    this.started = true;',
  '    this.timer = setInterval(() => this.flush().catch(err => {',
  '      console.error("[developerApiLogger] flush error:", err.message);',
  '    }), FLUSH_INTERVAL_MS);',
  '    if (this.timer.unref) this.timer.unref();',
  '    const cleanupHour = Number(process.env.DEVELOPER_LOG_CLEANUP_HOUR || 3);',
  '    const now = new Date();',
  '    const next = new Date(now);',
  '    next.setHours(cleanupHour, 17, 0, 0);',
  '    if (next <= now) next.setDate(next.getDate() + 1);',
  '    setTimeout(() => {',
  '      this.cleanup().catch(err => console.error("[developerApiLogger] cleanup error:", err.message));',
  '      setInterval(() => this.cleanup().catch(() => {}), 24 * 60 * 60 * 1000);',
  '    }, next.getTime() - now.getTime()).unref();',
  '  }',
  '',
  '  log(entry) {',
  '    if (!this.started) this.start();',
  '    this.buffer.push(entry);',
  '    if (this.buffer.length >= MAX_BUFFER) {',
  '      this.flush().catch(err => console.error("[developerApiLogger] flush error:", err.message));',
  '    }',
  '  }',
  '',
  '  async flush() {',
  '    if (this.buffer.length === 0) return;',
  '    const batch = this.buffer;',
  '    this.buffer = [];',
  '    try {',
  '      await this.models.OperationLog.bulkCreate(batch, { ignoreDuplicates: false });',
  '    } catch (err) {',
  '      console.error("[developerApiLogger] bulkCreate failed:", err.message);',
  '      this.buffer = batch.concat(this.buffer).slice(0, MAX_BUFFER);',
  '    }',
  '  }',
  '',
  '  async cleanup() {',
  '    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);',
  '    const deleted = await this.models.OperationLog.destroy({',
  '      where: { action: "developer_api_call", created_at: { [Op.lt]: cutoff } }',
  '    });',
  '    if (deleted > 0) {',
  '      console.log("[developerApiLogger] cleaned " + deleted + " entries older than " + RETENTION_DAYS + " days");',
  '    }',
  '  }',
  '}',
  '',
  'let instance = null;',
  'function getDeveloperApiLogger(models) {',
  '  if (!instance) {',
  '    instance = new DeveloperApiLogger(models);',
  '    instance.start();',
  '  }',
  '  return instance;',
  '}',
  '',
  'module.exports = { getDeveloperApiLogger, DeveloperApiLogger };',
  ''
].join(NL);

write("server/services/developerApiLogger.js", loggerSource);
