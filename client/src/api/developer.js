/**
 * 开发者平台 API
 */
import request from './request'

export const developerApi = {
  getScopeDocs() {
    return request.get('/developer/docs/scopes')
  },
  listAppCalls(id, params = {}) {
    return request.get(`/developer/apps/${id}/calls`, { params })
  },
  listApps() {
    return request.get('/developer/apps')
  },
  getApp(id) {
    return request.get(`/developer/apps/${id}`)
  },
  createApp(data) {
    return request.post('/developer/apps', data)
  },
  updateApp(id, data) {
    return request.patch(`/developer/apps/${id}`, data)
  },
  rotateSecret(id) {
    return request.post(`/developer/apps/${id}/rotate-secret`)
  },
  listAuthorizations() {
    return request.get('/developer/authorizations')
  },
  revokeAuthorization(id) {
    return request.delete(`/developer/authorizations/${id}`)
  }
}

export const oauthApi = {
  getAuthorizeInfo(params) {
    return request.get('/oauth/authorize-info', { params })
  },
  approveAuthorize(data) {
    return request.post('/oauth/authorize', data)
  }
}
