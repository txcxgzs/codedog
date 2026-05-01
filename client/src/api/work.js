/**
 * 作品相关API
 */

import request from './request'

export const workApi = {
  publish(codemaoWorkId, geetestData = {}) {
    return request.post('/works/publish', { codemaoWorkId, ...geetestData })
  },
  
  getList(params = {}) {
    return request.get('/works', { params })
  },
  
  getFeatured() {
    return request.get('/works/featured')
  },
  
  getById(codemaoId) {
    return request.get(`/works/${codemaoId}`)
  },
  
  getDetail(codemaoId) {
    return request.get(`/works/codemao/${codemaoId}`)
  },
  
  getUserWorks(userId, params = {}) {
    return request.get(`/works/user/${userId}`, { params })
  },
  
  getMyWorks(params = {}) {
    return request.get('/works/my', { params })
  },
  
  like(codemaoId, geetestData = {}) {
    return request.post(`/works/${codemaoId}/like`, geetestData)
  },
  
  update(codemaoId, data) {
    return request.put(`/works/${codemaoId}`, data)
  },
  
  delete(codemaoId) {
    return request.delete(`/works/${codemaoId}`)
  }
}
