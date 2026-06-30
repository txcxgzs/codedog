/**
 * 社区帖子相关API
 */

import request from './request'

export const postApi = {
  getPosts(params = {}) {
    return request.get('/posts', { params })
  },
  
  getPost(id) {
    return request.get(`/posts/${id}`)
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
