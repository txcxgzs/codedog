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
const { verifyCommunityStatus } = require('./communityStatus');
const { sequelize, UserProfile, Conversation, ConversationMember, Message, Group, Image, AdminAudit, Report, connectDatabase } = require('./database');
const { uploadImage } = require('./imageHost');
const { sceneConfig, registerCaptcha, validateCaptcha, requireCaptcha } = require('./captcha');

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
    const { session, user, peer } = await exchangeTicket(String(req.body?.ticket || ''), req);
    await UserProfile.upsert({ id: user.id, username: user.username, nickname: user.nickname || null, avatar: user.avatar || null, codemao_user_id: user.codemao_user_id || null, role: user.role || 'user' });
    if (peer?.id) await UserProfile.upsert({ id: Number(peer.id), username: peer.username, nickname: peer.nickname || null, avatar: peer.avatar || null, codemao_user_id: peer.codemao_user_id || null, role: peer.role || 'user' });
    const secure = config.production ? '; Secure' : '';
    res.append('Set-Cookie', `im_session=${session}; Path=/; HttpOnly; SameSite=Lax; Max-Age=1800${secure}`);
    ok(res, user, '登录成功');
  } catch (error) { fail(res, error.statusCode || 401, error.message || 'SSO 登录失败'); }
});

app.post('/api/auth/logout', requireSession, (req, res) => {
  const secure = config.production ? '; Secure' : '';
  res.append('Set-Cookie', `im_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
  ok(res, null, '已退出');
});
app.get('/api/me', requireSession, (req, res) => ok(res, req.user));
app.get('/api/captcha/config', requireSession, async (req, res, next) => {
  try { ok(res, await sceneConfig(req.user, String(req.query.scene || ''))); } catch (error) { next(error); }
});
app.get('/api/captcha/register', requireSession, async (req, res, next) => {
  try { ok(res, await registerCaptcha(req.user, String(req.query.scene || ''))); } catch (error) { next(error); }
});
app.post('/api/captcha/validate', requireSession, async (req, res, next) => {
  try { ok(res, await validateCaptcha(req.user, String(req.body?.scene || ''), req.body)); } catch (error) { next(error); }
});

const publicUser = value => value ? {
  id: Number(value.id), username: value.username, nickname: value.nickname,
  avatar: value.avatar, codemao_user_id: value.codemao_user_id, role: value.role
} : null;
const usersById = async ids => {
  const uniqueIds = [...new Set(ids.filter(Boolean).map(Number))];
  if (!uniqueIds.length) return new Map();
  const users = await UserProfile.findAll({ where: { id: { [Op.in]: uniqueIds } } });
  return new Map(users.map(user => [Number(user.id), publicUser(user)]));
};
const enrichMessages = async rows => {
  const profiles = await usersById(rows.map(row => row.sender_id));
  return rows.map(row => ({ ...row.toJSON(), sender: profiles.get(Number(row.sender_id)) || null }));
};

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
    const groups = await Promise.all(conversations.filter(item => item.type === 'group').map(item => Group.findOne({ where: { conversation_id: item.id } })));
    const groupById = new Map(groups.filter(Boolean).map(item => [String(item.conversation_id), item.toJSON()]));
    const peerIds = conversations.filter(item => item.type === 'direct').map(item => String(item.direct_key).split(':').map(Number).find(id => id !== Number(req.user.id)));
    const peers = await usersById(peerIds);
    ok(res, memberships.map(item => {
      const conversation = byId.get(String(item.conversation_id));
      if (!conversation) return null;
      const peerId = conversation.type === 'direct' ? String(conversation.direct_key).split(':').map(Number).find(id => id !== Number(req.user.id)) : null;
      const peer = peers.get(Number(peerId)) || null;
      return { ...conversation, title: conversation.type === 'group' ? groupById.get(String(conversation.id))?.name : (peer?.nickname || peer?.username || `用户 ${peerId}`), peer_id: peerId, peer, group: groupById.get(String(conversation.id)), membership: item.toJSON() };
    }).filter(Boolean));
  } catch (error) { next(error); }
});

app.post('/api/search', requireSession, requireCaptcha('im_search'), async (req, res, next) => {
  try {
    const keyword = String(req.body?.keyword || '').trim().slice(0, 50);
    if (!keyword) return ok(res, []);
    const where = { [Op.or]: [
      { username: { [Op.like]: `%${keyword}%` } },
      { nickname: { [Op.like]: `%${keyword}%` } },
      { codemao_user_id: { [Op.like]: `%${keyword}%` } }
    ] };
    const users = await UserProfile.findAll({ where, order: [['updated_at', 'DESC']], limit: 20 });
    ok(res, users.filter(user => Number(user.id) !== Number(req.user.id)).map(publicUser));
  } catch (error) { next(error); }
});

app.get('/api/conversation-requests', requireSession, async (req, res, next) => {
  try {
    const memberships = await ConversationMember.findAll({ where: { user_id: req.user.id, state: 'pending' }, order: [['created_at', 'DESC']] });
    const rows = await Promise.all(memberships.map(async membership => {
      const conversation = await Conversation.findByPk(membership.conversation_id);
      if (!conversation || conversation.type !== 'direct') return null;
      const fromUserId = String(conversation.direct_key).split(':').map(Number).find(id => id !== Number(req.user.id));
      const profile = await UserProfile.findByPk(fromUserId);
      return { conversation_id: conversation.id, from_user_id: fromUserId, from_user: publicUser(profile), created_at: membership.created_at };
    }));
    ok(res, rows.filter(Boolean));
  } catch (error) { next(error); }
});

app.post('/api/conversation-requests/:id', requireSession, async (req, res, next) => {
  try {
    const membership = await ConversationMember.findOne({ where: { conversation_id: req.params.id, user_id: req.user.id, state: 'pending' } });
    if (!membership) return fail(res, 404, '会话申请不存在或已处理');
    const action = req.body?.action;
    if (!['accept', 'reject'].includes(action)) return fail(res, 400, 'action 必须是 accept 或 reject');
    membership.state = action === 'accept' ? 'active' : 'removed';
    await membership.save();
    ok(res, { conversation_id: membership.conversation_id, state: membership.state }, action === 'accept' ? '已接受私聊申请' : '已拒绝私聊申请');
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

app.post('/api/conversations/group', requireSession, requireCaptcha('im_create_group'), async (req, res, next) => {
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

async function groupAndActor(conversationId, userId) {
  const [group, actor] = await Promise.all([
    Group.findOne({ where: { conversation_id: conversationId } }),
    ConversationMember.findOne({ where: { conversation_id: conversationId, user_id: userId, state: 'active' } })
  ]);
  return { group, actor };
}

app.get('/api/groups/:id', requireSession, async (req, res, next) => {
  try {
    const { group, actor } = await groupAndActor(req.params.id, req.user.id);
    if (!group || !actor) return fail(res, 404, '群聊不存在或你不是群成员');
    const members = await ConversationMember.findAll({ where: { conversation_id: req.params.id, state: 'active' }, order: [['created_at', 'ASC']] });
    ok(res, { ...group.toJSON(), members: members.map(item => item.toJSON()) });
  } catch (error) { next(error); }
});

app.post('/api/groups/:id/join', requireSession, async (req, res, next) => {
  try {
    const group = await Group.findOne({ where: { conversation_id: req.params.id } });
    if (!group) return fail(res, 404, '群聊不存在');
    const members = await ConversationMember.findAll({ where: { conversation_id: req.params.id, state: 'active' } });
    if (members.length >= Number(group.member_limit)) return fail(res, 409, `群成员已达到 ${group.member_limit} 人上限`);
    const existing = await ConversationMember.findOne({ where: { conversation_id: req.params.id, user_id: req.user.id } });
    if (existing) { existing.state = 'active'; if (existing.role !== 'owner') existing.role = 'member'; await existing.save(); }
    else await ConversationMember.create({ conversation_id: req.params.id, user_id: req.user.id, role: 'member', state: 'active' });
    ok(res, { conversation_id: Number(req.params.id), name: group.name }, '已加入群聊');
  } catch (error) { next(error); }
});

app.post('/api/groups/:id/members', requireSession, async (req, res, next) => {
  try {
    const { group, actor } = await groupAndActor(req.params.id, req.user.id);
    if (!group || !actor) return fail(res, 404, '群聊不存在');
    if (!['owner', 'admin'].includes(actor.role)) return fail(res, 403, '只有群主或管理员可以邀请成员');
    const userId = Number(req.body?.user_id);
    if (!Number.isInteger(userId) || userId <= 0) return fail(res, 400, '无效用户 ID');
    const members = await ConversationMember.findAll({ where: { conversation_id: req.params.id, state: 'active' } });
    if (members.length >= Number(group.member_limit)) return fail(res, 409, `群成员已达到 ${group.member_limit} 人上限`);
    const existing = await ConversationMember.findOne({ where: { conversation_id: req.params.id, user_id: userId } });
    if (existing) { existing.state = 'active'; existing.role = existing.role === 'owner' ? 'owner' : 'member'; await existing.save(); }
    else await ConversationMember.create({ conversation_id: req.params.id, user_id: userId, role: 'member', state: 'active' });
    broadcastConversation(req.params.id, 'member.updated', { user_id: userId, state: 'active' });
    ok(res, { user_id: userId }, '成员已加入群聊');
  } catch (error) { next(error); }
});

app.delete('/api/groups/:id/members/:userId', requireSession, async (req, res, next) => {
  try {
    const { group, actor } = await groupAndActor(req.params.id, req.user.id);
    if (!group || !actor) return fail(res, 404, '群聊不存在');
    const target = await ConversationMember.findOne({ where: { conversation_id: req.params.id, user_id: req.params.userId, state: 'active' } });
    if (!target) return fail(res, 404, '成员不存在');
    const selfLeave = Number(req.params.userId) === Number(req.user.id);
    if (!selfLeave && !['owner', 'admin'].includes(actor.role)) return fail(res, 403, '没有移除成员权限');
    if (target.role === 'owner') return fail(res, 409, '群主必须先转让群聊，不能直接退出或被移除');
    if (actor.role === 'admin' && target.role === 'admin') return fail(res, 403, '管理员不能移除其他管理员');
    target.state = selfLeave ? 'left' : 'removed'; await target.save();
    broadcastConversation(req.params.id, 'member.updated', { user_id: Number(req.params.userId), state: target.state });
    ok(res, null, selfLeave ? '已退出群聊' : '成员已移除');
  } catch (error) { next(error); }
});

app.patch('/api/groups/:id/members/:userId', requireSession, async (req, res, next) => {
  try {
    const { group, actor } = await groupAndActor(req.params.id, req.user.id);
    if (!group || !actor) return fail(res, 404, '群聊不存在');
    if (actor.role !== 'owner') return fail(res, 403, '只有群主可以设置管理员');
    const target = await ConversationMember.findOne({ where: { conversation_id: req.params.id, user_id: req.params.userId, state: 'active' } });
    if (!target || target.role === 'owner') return fail(res, 400, '目标成员不可修改');
    const role = req.body?.role; if (!['admin', 'member'].includes(role)) return fail(res, 400, 'role 必须是 admin 或 member');
    target.role = role; await target.save();
    broadcastConversation(req.params.id, 'member.updated', { user_id: Number(req.params.userId), role });
    ok(res, target, role === 'admin' ? '已设为群管理员' : '已取消群管理员');
  } catch (error) { next(error); }
});

app.patch('/api/groups/:id', requireSession, async (req, res, next) => {
  try {
    const { group, actor } = await groupAndActor(req.params.id, req.user.id);
    if (!group || !actor) return fail(res, 404, '群聊不存在');
    if (req.body?.name !== undefined) {
      if (!['owner', 'admin'].includes(actor.role)) return fail(res, 403, '没有修改群资料权限');
      const name = String(req.body.name).trim(); if (!name || name.length > 50) return fail(res, 400, '群名称长度应为 1-50 个字符'); group.name = name;
    }
    if (req.body?.member_limit !== undefined) {
      if (!['admin', 'superadmin'].includes(req.user.role)) return fail(res, 403, '只有编程狗管理员可以设置群容量例外');
      const reason = String(req.body.reason || '').trim(); if (reason.length < 5) return fail(res, 400, '设置容量例外必须填写至少 5 个字符的原因');
      const limit = Number(req.body.member_limit); if (!Number.isInteger(limit) || limit < config.groupDefaultLimit || limit > config.groupHardLimit) return fail(res, 400, `群容量必须在 ${config.groupDefaultLimit}-${config.groupHardLimit} 之间`);
      const oldLimit = Number(group.member_limit); group.member_limit = limit;
      await AdminAudit.create({ admin_id: req.user.id, action: 'group.member_limit.update', reason, filters: { conversation_id: Number(req.params.id), old_limit: oldLimit, new_limit: limit }, source_ip: req.ip });
    }
    await group.save(); broadcastConversation(req.params.id, 'conversation.updated', group.toJSON()); ok(res, group, '群资料已更新');
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
    ok(res, await enrichMessages(rows));
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

app.post('/api/reports', requireSession, async (req, res, next) => {
  try {
    const messageId = Number(req.body?.message_id), reason = String(req.body?.reason || '').trim();
    if (!Number.isInteger(messageId) || messageId <= 0 || reason.length < 5 || reason.length > 500) return fail(res, 400, '请选择消息并填写 5-500 字举报原因');
    const message = await Message.findOne({ where: { id: messageId } });
    if (!message || !await requireMember(req.user.id, message.conversation_id)) return fail(res, 404, '消息不存在');
    if (Number(message.sender_id) === Number(req.user.id)) return fail(res, 400, '不能举报自己的消息');
    const existing = await Report.findOne({ where: { reporter_id: req.user.id, message_id: messageId } });
    if (existing) return fail(res, 409, '你已举报过这条消息');
    const report = await Report.create({ reporter_id: req.user.id, message_id: messageId, conversation_id: message.conversation_id, reason, status: 'pending' });
    ok(res, report, '举报已提交');
  } catch (error) { next(error); }
});

app.post('/api/messages', requireSession, requireCaptcha('im_message'), async (req, res, next) => {
  try { const message = await createMessage(req.user, req.body || {}); const [data] = await enrichMessages([message]); broadcastConversation(message.conversation_id, 'message.new', data); ok(res, data, '消息已发送'); }
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

app.get('/api/admin/reports', requireSession, async (req, res, next) => {
  try {
    if (!['admin', 'superadmin'].includes(req.user.role)) return fail(res, 403, '无举报查看权限');
    const rows = await Report.findAll({ where: req.query.status ? { status: req.query.status } : {}, order: [['created_at', 'DESC']], limit: 100 });
    ok(res, rows);
  } catch (error) { next(error); }
});

app.patch('/api/admin/reports/:id', requireSession, async (req, res, next) => {
  try {
    if (!['admin', 'superadmin'].includes(req.user.role)) return fail(res, 403, '无举报处理权限');
    const report = await Report.findOne({ where: { id: Number(req.params.id) } });
    if (!report) return fail(res, 404, '举报不存在');
    const status = req.body?.status, reason = String(req.body?.reason || '').trim();
    if (!['resolved', 'rejected'].includes(status)) return fail(res, 400, '处理状态无效');
    if (reason.length < 5 || reason.length > 500) return fail(res, 400, '处理意见应为 5-500 个字符');
    report.status = status; report.resolution_reason = reason; report.resolved_by = req.user.id; report.resolved_at = new Date();
    await report.save();
    await AdminAudit.create({ admin_id: req.user.id, action: `report.${status}`, reason, filters: { report_id: Number(report.id), message_id: Number(report.message_id), conversation_id: Number(report.conversation_id) }, source_ip: req.ip });
    ok(res, report, status === 'resolved' ? '举报已处理' : '举报已驳回');
  } catch (error) { next(error); }
});

app.get('/api/admin/groups', requireSession, async (req, res, next) => {
  try {
    if (!['admin', 'superadmin'].includes(req.user.role)) return fail(res, 403, '无群聊管理权限');
    const groups = await Group.findAll({ order: [['updated_at', 'DESC']] });
    const rows = await Promise.all(groups.map(async group => {
      const members = await ConversationMember.findAll({ where: { conversation_id: group.conversation_id, state: 'active' } });
      const owner = await UserProfile.findByPk(group.owner_id);
      return { ...group.toJSON(), member_count: members.length, owner: publicUser(owner) };
    }));
    ok(res, rows);
  } catch (error) { next(error); }
});

app.use((error, req, res, next) => {
  console.error(error);
  if (error instanceof multer.MulterError) return fail(res, 400, error.code === 'LIMIT_FILE_SIZE' ? '图片不能超过 5 MB' : '图片上传请求无效');
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

server.on('upgrade', async (req, socket, head) => {
  if (req.url !== '/ws') return socket.destroy();
  if (req.headers.origin && config.publicOrigins.length && !config.publicOrigins.includes(req.headers.origin)) return socket.destroy();
  const user = parseSession(req);
  if (!user) return socket.destroy();
  try { await verifyCommunityStatus(user); } catch { return socket.destroy(); }
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, user));
});
wss.on('connection', (ws, user) => {
  const set = socketsByUser.get(Number(user.id)) || new Set(); set.add(ws); socketsByUser.set(Number(user.id), set);
  ws.send(JSON.stringify({ version: 1, event: 'auth.ok', data: { user_id: user.id } }));
  const statusTimer = setInterval(() => verifyCommunityStatus(user, true).catch(() => ws.close(4001, 'account status invalid')), 60 * 1000);
  ws.on('message', async raw => {
    try {
      const frame = JSON.parse(raw.toString());
      if (frame.event === 'ping') return ws.send(JSON.stringify({ version: 1, event: 'pong', data: { at: Date.now() } }));
      if (frame.event === 'message.send') {
        const message = await createMessage(user, frame.data || {});
        const [data] = await enrichMessages([message]);
        ws.send(JSON.stringify({ version: 1, event: 'message.ack', request_id: frame.request_id, data }));
        broadcastConversation(message.conversation_id, 'message.new', data);
      }
    } catch (error) { ws.send(JSON.stringify({ version: 1, event: 'message.error', data: { message: error.message } })); }
  });
  ws.on('close', () => { clearInterval(statusTimer); set.delete(ws); if (!set.size) socketsByUser.delete(Number(user.id)); });
});

async function start() {
  await connectDatabase();
  await connectReplayStore();
  server.listen(config.port, '0.0.0.0', () => console.log(`CodeDog IM server listening on ${config.port}`));
}
if (require.main === module) start().catch(error => { console.error(error); process.exit(1); });

module.exports = { app, server, start };
