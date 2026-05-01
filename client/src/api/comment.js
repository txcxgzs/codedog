/**
 * 评论相关API
 */

import request from './request'

export const commentApi = {
  getWorkComments(workId, params = {}) {
    return request.get(`/comments/work/${workId}`, { params })
  },
  
  createComment(data) {
    return request.post('/comments', data)
  },
  
  deleteComment(id) {
    return request.delete(`/comments/${id}`)
  },
  
  likeComment(id, geetestData = {}) {
    return request.post(`/comments/${id}/like`, geetestData)
  }
}
