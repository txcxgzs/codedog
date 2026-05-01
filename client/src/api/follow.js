/**
 * 关注相关API
 */

import request from './request'

export const followApi = {
  follow(codemaoUserId) {
    return request.post('/follows', { codemaoUserId })
  },
  
  unfollow(codemaoUserId) {
    return request.delete(`/follows/${codemaoUserId}`)
  },
  
  check(codemaoUserId) {
    return request.get(`/follows/check/${codemaoUserId}`)
  },
  
  getFollowers(codemaoUserId, params = {}) {
    return request.get(`/follows/followers/${codemaoUserId}`, { params })
  },
  
  getFollowing(codemaoUserId, params = {}) {
    return request.get(`/follows/following/${codemaoUserId}`, { params })
  }
}
