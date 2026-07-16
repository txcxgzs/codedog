/**
 * 社区帖子相关API
 */

import request from './request'

export const postApi = {
  getDraft() {
    return request.get('/posts/drafts/current')
  },

  saveDraft(data) {
    return request.put('/posts/drafts/current', data)
  },

  deleteDraft() {
    return request.delete('/posts/drafts/current')
  },
  getBoards() {
    return request.get('/posts/boards/list')
  },

  toggleBoardSubscription(boardId) {
    return request.post(`/posts/boards/${boardId}/subscription`)
  },

  toggleSubscription(id) {
    return request.post(`/posts/${id}/subscription`)
  },

  acceptAnswer(id, commentId) {
    return request.post(`/posts/${id}/answers/${commentId}/accept`)
  },
  getPosts(params = {}) {
    return request.get('/posts', { params })
  },
  
  getPost(id, params = {}) {
    return request.get(`/posts/${id}`, { params })
  },
  
  createPost(data) {
    return request.post('/posts', data)
  },
  
  updatePost(id, data) {
    return request.put(`/posts/${id}`, data)
  },
  
  deletePost(id) {
    return request.delete(`/posts/${id}`)
  },
  
  likePost(id, geetestData = {}) {
    return request.post(`/posts/${id}/like`, geetestData)
  },

  getMyPosts(params = {}) {
    return request.get('/posts/my/list', { params })
  }
}
