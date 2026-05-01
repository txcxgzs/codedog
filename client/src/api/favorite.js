/**
 * 收藏相关API
 */

import request from './request'

export const favoriteApi = {
  add(workId) {
    return request.post('/favorites', { workId })
  },
  
  remove(workId) {
    return request.delete(`/favorites/${workId}`)
  },
  
  getMyFavorites(params = {}) {
    return request.get('/favorites/my', { params })
  },
  
  check(workId) {
    return request.get(`/favorites/check/${workId}`)
  }
}
