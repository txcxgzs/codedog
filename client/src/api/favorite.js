/**
 * 收藏相关API
 */

import request from './request'

export const favoriteApi = {
  add(workId, geetestData = {}) {
    return request.post('/favorites', { workId, ...geetestData })
  },

  remove(workId, geetestData = {}) {
    return request.delete(`/favorites/${workId}`, { data: geetestData })
  },

  getMyFavorites(params = {}) {
    return request.get('/favorites/my', { params })
  },

  getUserFavorites(codemaoUserId, params = {}) {
    return request.get(`/favorites/user/${codemaoUserId}`, { params })
  },

  check(workId) {
    return request.get(`/favorites/check/${workId}`)
  },

  favoritePost(postId, geetestData = {}) {
    return request.post(`/posts/${postId}/favorite`, geetestData)
  },

  unfavoritePost(postId, geetestData = {}) {
    return request.delete(`/posts/${postId}/favorite`, { data: geetestData })
  }
}
