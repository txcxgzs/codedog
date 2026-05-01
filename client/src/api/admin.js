/**
 * 后台管理API
 */

import request from './request'

export const adminApi = {
  /**
   * 统计数据
   */
  getStats() {
    return request.get('/admin/stats')
  },
  
  /**
   * 数据趋势
   */
  getTrends(days = 7) {
    return request.get('/admin/trends', { params: { days } })
  },
  
  /**
   * 用户管理
   */
  getUsers(params = {}) {
    return request.get('/admin/users', { params })
  },
  
  getUserDetail(userId) {
    return request.get(`/admin/users/${userId}`)
  },
  
  updateUserStatus(userId, status) {
    return request.put(`/admin/users/${userId}/status`, { status })
  },
  
  updateUserRole(userId, role) {
    return request.put(`/admin/users/${userId}/role`, { role })
  },
  
  updateUser(userId, data) {
    return request.put(`/admin/users/${userId}`, data)
  },
  
  impersonateUser(userId) {
    return request.post(`/admin/users/${userId}/impersonate`)
  },
  
  updateUserPassword(userId, newPassword) {
    return request.put(`/admin/users/${userId}/password`, { newPassword })
  },
  
  sendUserNotification(userId, title, content) {
    return request.post(`/admin/users/${userId}/notification`, { title, content })
  },
  
  sendBatchNotifications(userIds, title, content) {
    return request.post('/admin/users/batch-notification', { userIds, title, content })
  },
  
  sendAllUsersNotification(title, content) {
    return request.post('/admin/users/all-notification', { title, content })
  },
  
  deleteUser(userId) {
    return request.delete(`/admin/users/${userId}`)
  },
  
  /**
   * 作品管理
   */
  getWorks(params = {}) {
    return request.get('/admin/works', { params })
  },
  
  updateWork(workId, data) {
    return request.put(`/admin/works/${workId}`, data)
  },
  
  setWorkFeatured(workId, isFeatured) {
    return request.put(`/admin/works/${workId}/featured`, { isFeatured })
  },
  
  deleteWork(workId) {
    return request.delete(`/admin/works/${workId}`)
  },
  
  recalibrateWorks() {
    return request.post('/admin/works/recalibrate')
  },
  
  /**
   * 评论管理
   */
  getComments(params = {}) {
    return request.get('/admin/comments', { params })
  },
  
  updateCommentStatus(commentId, status) {
    return request.put(`/admin/comments/${commentId}/status`, { status })
  },
  
  deleteComment(commentId) {
    return request.delete(`/admin/comments/${commentId}`)
  },
  
  /**
   * 帖子管理
   */
  getPosts(params = {}) {
    return request.get('/admin/posts', { params })
  },
  
  setPostEssence(postId, isEssence) {
    return request.put(`/admin/posts/${postId}/essence`, { isEssence })
  },
  
  setPostTop(postId, isTop) {
    return request.put(`/admin/posts/${postId}/top`, { isTop })
  },
  
  updatePost(postId, data) {
    return request.put(`/admin/posts/${postId}`, data)
  },
  
  deletePost(postId) {
    return request.delete(`/admin/posts/${postId}`)
  },
  
  /**
   * 轮播图管理
   */
  getBanners() {
    return request.get('/admin/banners')
  },
  
  createBanner(data) {
    return request.post('/admin/banners', data)
  },
  
  updateBanner(bannerId, data) {
    return request.put(`/admin/banners/${bannerId}`, data)
  },
  
  deleteBanner(bannerId) {
    return request.delete(`/admin/banners/${bannerId}`)
  },
  
  crawlBanners() {
    return request.post('/admin/crawl/banners')
  },
  
  /**
   * 举报管理
   */
  getReports(params = {}) {
    return request.get('/admin/reports', { params })
  },
  
  handleReport(reportId, data) {
    return request.put(`/admin/reports/${reportId}`, data)
  },
  
  /**
   * IP封禁管理
   */
  getIpBans(params = {}) {
    return request.get('/admin/ip-bans', { params })
  },
  
  addIpBan(data) {
    return request.post('/admin/ip-bans', data)
  },
  
  removeIpBan(ipBanId) {
    return request.delete(`/admin/ip-bans/${ipBanId}`)
  },
  
  /**
   * 爬取功能
   */
  crawlWork(workId) {
    return request.post('/admin/crawl/work', { workId })
  },
  
  crawlHotWorks(count = 20) {
    return request.post('/admin/crawl/hot', { count }, { timeout: 180000 })
  },
  
  crawlUserWorks(userId, limit = 100) {
    return request.post('/admin/crawl/user', { userId, limit }, { timeout: 180000 })
  },
  
  crawlPostWorks(keyword, limit = 20) {
    return request.post('/admin/crawl/posts', { keyword, limit }, { timeout: 180000 })
  },
  
  getCrawlLogs(taskId) {
    return request.get('/admin/crawl/logs', { params: { taskId } })
  },
  
  /**
   * 实时日志
   */
  getRealtimeLogs(lastTime, limit = 100) {
    return request.get('/admin/logs/realtime', { params: { lastTime, limit } })
  },
  
  clearRealtimeLogs() {
    return request.delete('/admin/logs/realtime')
  },
  
  /**
   * 角色管理
   */
  getRoles() {
    return request.get('/admin/roles')
  },
  
  getAdminUsers(params = {}) {
    return request.get('/admin/admin-users', { params })
  },
  
  /**
   * 公告管理
   */
  getAnnouncements(params = {}) {
    return request.get('/admin/announcements', { params })
  },
  
  createAnnouncement(data) {
    return request.post('/admin/announcements', data)
  },
  
  updateAnnouncement(announcementId, data) {
    return request.put(`/admin/announcements/${announcementId}`, data)
  },
  
  deleteAnnouncement(announcementId) {
    return request.delete(`/admin/announcements/${announcementId}`)
  },
  
  /**
   * 系统设置
   */
  getConfigs() {
    return request.get('/admin/configs')
  },
  
  updateConfig(key, data) {
    return request.put(`/admin/configs/${key}`, data)
  },
  
  batchUpdateConfigs(configs) {
    return request.post('/admin/configs/batch', { configs })
  },
  
  /**
   * 操作日志
   */
  getOperationLogs(params = {}) {
    return request.get('/admin/operation-logs', { params })
  },
  
  /**
   * 敏感词管理
   */
  getSensitiveWords(params = {}) {
    return request.get('/admin/sensitive-words', { params })
  },
  
  addSensitiveWord(data) {
    return request.post('/admin/sensitive-words', data)
  },
  
  updateSensitiveWord(wordId, data) {
    return request.put(`/admin/sensitive-words/${wordId}`, data)
  },
  
  deleteSensitiveWord(wordId) {
    return request.delete(`/admin/sensitive-words/${wordId}`)
  },
  
  batchImportSensitiveWords(words, category, level) {
    return request.post('/admin/sensitive-words/batch-import', { words, category, level })
  },
  
  /**
   * AI审核
   */
  aiReviewReport(reportId) {
    return request.post(`/admin/ai/review/${reportId}`)
  },
  
  aiBatchReviewReports(reportIds) {
    return request.post('/admin/ai/batch-review', { reportIds })
  },
  
  aiAutoHandleReports(reportIds) {
    return request.post('/admin/ai/auto-handle', { reportIds })
  },
  
  /**
   * 权限管理
   */
  getPermissions() {
    return request.get('/admin/permissions')
  },
  
  getRolePermissions() {
    return request.get('/admin/role-permissions')
  },
  
  updateRolePermissions(role, data) {
    return request.put(`/admin/role-permissions/${role}`, data)
  },
  
  resetRolePermissions(role) {
    return request.post(`/admin/role-permissions/${role}/reset`)
  },
  
  getCaptchaStats(days = 7) {
    return request.get('/admin/captcha-stats', { params: { days } })
  },
  
  getStudios(params = {}) {
    return request.get('/admin/studios', { params })
  },
  
  getStudioDetail(studioId) {
    return request.get(`/admin/studios/${studioId}`)
  },
  
  updateStudio(id, data) {
    return request.put(`/admin/studios/${id}`, data)
  },
  
  updateStudioStatus(id, status) {
    return request.put(`/admin/studios/${id}/status`, { status })
  },
  
  updateStudioPoints(id, data) {
    return request.put(`/admin/studios/${id}/points`, data)
  },
  
  updateStudioMember(studioId, userId, data) {
    return request.put(`/admin/studios/${studioId}/members/${userId}`, data)
  },
  
  removeStudioMember(studioId, userId) {
    return request.delete(`/admin/studios/${studioId}/members/${userId}`)
  },
  
  removeStudioWork(studioId, workId) {
    return request.delete(`/admin/studios/${studioId}/works/${workId}`)
  },
  
  setWorkScore(studioWorkId, score) {
    return request.put(`/admin/studio-works/${studioWorkId}/score`, { score })
  },
  
  deleteStudio(id) {
    return request.delete(`/admin/studios/${id}`)
  },
  
  updateUserLevel(userId, level) {
    return request.put(`/admin/users/${userId}/level`, { level })
  }
}
