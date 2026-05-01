import request from './request'

export const studioApi = {
  getStudios(params = {}) {
    return request.get('/studios', { params })
  },
  
  getStudio(id) {
    return request.get(`/studios/${id}`)
  },
  
  createStudio(data) {
    return request.post('/studios', data)
  },
  
  updateStudio(id, data) {
    return request.put(`/studios/${id}`, data)
  },
  
  deleteStudio(id) {
    return request.delete(`/studios/${id}`)
  },
  
  joinStudio(id, geetestData = {}) {
    return request.post(`/studios/${id}/join`, geetestData)
  },
  
  leaveStudio(id) {
    return request.post(`/studios/${id}/leave`)
  },
  
  getMyStudios() {
    return request.get('/studios/my/list')
  },
  
  getStudioWorks(id, params = {}) {
    return request.get(`/studios/${id}/works`, { params })
  },
  
  submitWork(id, workId, geetestData = {}) {
    return request.post(`/studios/${id}/works`, { workId, ...geetestData })
  },
  
  reviewWork(id, workId, action) {
    return request.post(`/studios/${id}/works/${workId}/review`, { action })
  },
  
  removeWork(id, workId) {
    return request.delete(`/studios/${id}/works/${workId}`)
  },
  
  toggleWorkStatus(id, workId, action) {
    return request.put(`/studios/${id}/works/${workId}/status`, { action })
  },
  
  getPendingMembers(id) {
    return request.get(`/studios/${id}/pending-members`)
  },
  
  reviewMember(id, memberId, action, geetestData = {}) {
    return request.post(`/studios/${id}/members/${memberId}/review`, { action, ...geetestData })
  },
  
  setMemberRole(id, memberId, role) {
    return request.put(`/studios/${id}/members/${memberId}/role`, { role })
  },
  
  kickMember(id, memberId) {
    return request.delete(`/studios/${id}/members/${memberId}`)
  },
  
  getPendingWorks(id) {
    return request.get(`/studios/${id}/pending-works`)
  },
  
  setViceOwner(id, userId) {
    return request.put(`/studios/${id}/vice-owner`, { user_id: userId })
  },
  
  dissolveStudio(id) {
    return request.delete(`/studios/${id}/dissolve`)
  }
}
