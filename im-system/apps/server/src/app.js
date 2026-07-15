const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const multer = require('multer');
const { WebSocketServer } = require('ws');
const { Op } = require('sequelize');
const config = require('./config');
const { exchangeTicket, parseSession, requireSession } = require('./auth');
const { connectReplayStore } = require('./replayStore');
const { sequelize, Conversation, ConversationMember, Message, Group, Image, AdminAudit, connectDatabase } = require('./database');
const { uploadImage } = require('./imageHost');

const app = express();
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin(origin, cb) {
  if (!origin || !config.publicOrigins.length || config.publicOrigins.includes(origin)) return cb(null, true);
  cb(new Error('Origin is not allowed'));
}, credentials: true }));
app.use(express.json({ limit: '64kb' }));

const ok = (res, data, msg = 'ok') => res.json({ code: 200, msg, data });
const fail = (res, status, msg) => res.status(status).json({ code: status, msg, data: null });

app.get('/health', async (req, res) => {
  try { await sequelize.authenticate(); ok(res, { status: 'healthy', database: 'up', version: '0.1.0' }); }
  catch { fail(res, 503, 'database unavailable'); }
});

app.post('/api/auth/sso/exchange', async (req, res) => {
  try {
    const { session, user } = await exchangeTicket(String(req.body?.ticket || ''));
    const secure = config.production ? '; Secure' : '';
    res.append('Set-Cookie', `im_session=${session}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200${secure}`);
    ok(res, user, '登录成功');
  } catch (error) { fail(res, error.statusCode || 401, error.message || 'SSO 登录失败'); }
});

app.post('/api/auth/logout', requireSession, (req, res) => {
  const secure = config.production ? '; Secure' : '';
  res.append('Set-Cookie', `im_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
  ok(res, null, '已退出');
});
app.get('/api/me', requireSession, (req, res) => ok(res, req.user));

const imageTempDir = path.join(config.root, 'data/image-temp');
fs.mkdirSync(imageTempDir, { recursive: true });
const imageUpload = multer({ dest: imageTempDir, limits: { fileSize: 5 * 1024 * 1024, files: 1 }, fileFilter: (req, file, cb) => cb(null, ['image/jpeg','image/png','image/webp','image/gif'].includes(file.mimetype)) });
app.post('/api/images', requireSession, imageUpload.single('image'), async (req, res, next) => {
  if (!req.file) return fail(res, 400, '请选择不超过 5 MB 的 JPG、PNG、WebP 或 GIF 图片');
  try {
    const sha256 = crypto.createHash('sha256').update(fs.readFileSync(req.file.path)).digest('hex');
    const url = await uploadImage(req.file);
    const image = await Image.create({ user_id: req.user.id, url, mime: req.file.mimetype, size: req.file.size, sha256, status: 'ready' });
    ok(res, image, '图片已上传到编程狗现有图床');
  } catch (error) { next(error); }
  finally { fs.promises.unlink(req.file.path).catch(() => {}); }
});

app.get('/api/conversations', requireSession, async (req, res, next) => {
  try {
    const memberships = await ConversationMember.findAll({ where: { user_id: req.user.id, state: 'active' }, order: [['updated_at', 'DESC']] });
    const ids = memberships.map(item => item.conversation_id);
    const conversations = ids.length ? await Conversation.findAll({ where: { id: { [Op.in]: ids } } }) : [];
    const byId = new Map(conversations.map(item => [String(item.id), item.toJSON()]));
    ok(res, memberships.map(item => ({ ...byId.get(String(item.conversation_id)), membership: item.toJSON() })).filter(item => item.id));
  } catch (error) { next(error); }
});

app.post('/api/conversations/direct', requireSession, async (req, res, next) => {
  try {
    const peerId = Number(req.body?.user_id);
    if (!Number.isInteger(peerId) || peerId <= 0 || peerId === req.user.id) return fail(res, 400, '无效的私聊用户');
    const pair = [req.user.id, peerId].sort((a, b) => a - b);
    const directKey = `${pair[0]}:${pair[1]}`;
    const [conversation] = await Conversation.findOrCreate({ where: { direct_key: directKey }, defaults: { type: 'direct', direct_key: directKey } });
    await Promise.all(pair.map(userId => ConversationMember.findOrCreate({
      where: { conversation_id: conversation.id, user_id: userId },
      defaults: { role: 'member', state: userId === req.user.id ? 'active' : 'pending' }
    })));
    ok(res, conversation, '会话已创建');
  } catch (error) { next(error); }
});

app.post('/api/conversations/group', requireSession, async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name || name.length > 50) return fail(res, 400, '群名称长度应为 1-50 个字符');
    const conversation = await sequelize.transaction(async transaction => {
      const row = await Conversation.create({ type: 'group' }, { transaction });
      await ConversationMember.create({ conversation_id: row.id, user_id: req.user.id, role: 'owner', state: 'active' }, { transaction });
      await Group.create({ conversation_id: row.id, name, owner_id: req.user.id, member_limit: config.groupDefaultLimit }, { transaction });
      return row;
    });
    ok(res, { ...conversation.toJSON(), name, member_limit: config.groupDefaultLimit }, '群聊已创建');
  } catch (error) { next(error); }
});

async function requireMember(userId, conversationId) {
  return ConversationMember.findOne({ where: { user_id: userId, conversation_id: conversationId, state: 'active' } });
}

app.get('/api/conversations/:id/messages', requireSession, async (req, res, next) => {
  try {
    if (!await requireMember(req.user.id, req.params.id)) return fail(res, 403, '你不在该会话中');
    const after = Math.max(0, Number(req.query.after_sequence || 0));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
    const rows = await Message.findAll({ where: { conversation_id: req.params.id, sequence: { [Op.gt]: after } }, order: [['sequence', 'ASC']], limit });
    ok(res, rows);
  } catch (error) { next(error); }
});

async function createMessage(user, input) {
  const conversationId = Number(input.conversation_id);
  if (!await requireMember(user.id, conversationId)) {
    const error = new Error('你不在该会话中'); error.statusCode = 403; throw error;
  }
  const type = input.type === 'image' ? 'image' : 'text';
  let content = String(input.content || '').trim();
  let image = null;
  if (type === 'image') {
    image = await Image.findOne({ where: { id: Number(input.image_id), user_id: user.id, status: 'ready' } });
    if (!image) { const error = new Error('图片不存在、已使用或无权使用'); error.statusCode = 400; throw error; }
    content = JSON.stringify({ image_id: image.id, url: image.url, mime: image.mime, size: image.size });
  }
  if (!content || content.length > 10000) {
    const error = new Error('消息长度应为 1-10000 个字符'); error.statusCode = 400; throw error;
  }
  const clientId = String(input.client_message_id || crypto.randomUUID());
  const existing = await Message.findOne({ where: { sender_id: user.id, client_message_id: clientId } });
  if (existing) return existing;
  return sequelize.transaction(async transaction => {
    const conversation = await Conversation.findByPk(conversationId, { transaction, lock: transaction.LOCK.UPDATE });
    const sequence = Number(conversation.last_sequence) + 1;
    conversation.last_sequence = sequence;
    await conversation.save({ transaction });
    const message = await Message.create({ conversation_id: conversationId, sequence, sender_id: user.id, client_message_id: clientId, type, content }, { transaction });
    if (image) { image.status = 'used'; await image.save({ transaction }); }
    return message;
  });
}

app.post('/api/messages', requireSession, async (req, res, next) => {
  try { const message = await createMessage(req.user, req.body || {}); broadcastConversation(message.conversation_id, 'message.new', message.toJSON()); ok(res, message, '消息已发送'); }
  catch (error) { next(error); }
});

app.post('/api/admin/messages/search', requireSession, async (req, res, next) => {
  try {
    if (!['admin', 'superadmin'].includes(req.user.role)) return fail(res, 403, '无聊天记录查看权限');
    const reason = String(req.body?.reason || '').trim();
    if (reason.length < 5) return fail(res, 400, '查看聊天记录必须填写至少 5 个字符的审计原因');
    const where = {};
    if (req.body?.conversation_id) where.conversation_id = Number(req.body.conversation_id);
    if (req.body?.user_id) where.sender_id = Number(req.body.user_id);
    if (req.body?.keyword) where.content = { [Op.like]: `%${String(req.body.keyword).slice(0, 100)}%` };
    const rows = await Message.findAll({ where, order: [['created_at', 'DESC']], limit: Math.min(100, Number(req.body?.limit || 50)) });
    const filters = { conversation_id: req.body?.conversation_id, user_id: req.body?.user_id, keyword: req.body?.keyword };
    await AdminAudit.create({ admin_id: req.user.id, action: 'messages.search', reason, filters, source_ip: req.ip });
    ok(res, rows);
  } catch (error) { next(error); }
});

app.use((error, req, res, next) => {
  console.error(error);
  fail(res, error.statusCode || 500, error.statusCode ? error.message : 'IM 服务内部错误');
});

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
const socketsByUser = new Map();

function broadcastConversation(conversationId, event, data) {
  ConversationMember.findAll({ where: { conversation_id: conversationId, state: 'active' }, attributes: ['user_id'] }).then(members => {
    for (const member of members) for (const socket of socketsByUser.get(Number(member.user_id)) || []) {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify({ version: 1, event, data }));
    }
  }).catch(console.error);
}

server.on('upgrade', (req, socket, head) => {
  if (req.url !== '/ws') return socket.destroy();
  if (req.headers.origin && config.publicOrigins.length && !config.publicOrigins.includes(req.headers.origin)) return socket.destroy();
  const user = parseSession(req);
  if (!user) return socket.destroy();
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, user));
});
wss.on('connection', (ws, user) => {
  const set = socketsByUser.get(Number(user.id)) || new Set(); set.add(ws); socketsByUser.set(Number(user.id), set);
  ws.send(JSON.stringify({ version: 1, event: 'auth.ok', data: { user_id: user.id } }));
  ws.on('message', async raw => {
    try {
      const frame = JSON.parse(raw.toString());
      if (frame.event === 'ping') return ws.send(JSON.stringify({ version: 1, event: 'pong', data: { at: Date.now() } }));
      if (frame.event === 'message.send') {
        const message = await createMessage(user, frame.data || {});
        ws.send(JSON.stringify({ version: 1, event: 'message.ack', request_id: frame.request_id, data: message.toJSON() }));
        broadcastConversation(message.conversation_id, 'message.new', message.toJSON());
      }
    } catch (error) { ws.send(JSON.stringify({ version: 1, event: 'message.error', data: { message: error.message } })); }
  });
  ws.on('close', () => { set.delete(ws); if (!set.size) socketsByUser.delete(Number(user.id)); });
});

async function start() {
  await connectDatabase();
  await connectReplayStore();
  server.listen(config.port, '0.0.0.0', () => console.log(`CodeDog IM server listening on ${config.port}`));
}
if (require.main === module) start().catch(error => { console.error(error); process.exit(1); });

module.exports = { app, server, start };
