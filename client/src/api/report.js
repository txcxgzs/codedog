/**
 * 举报API
 */

import request from './request'

export const reportApi = {
  create(data, geetestData = {}) {
    return request.post('/reports', { ...data, ...geetestData })
  },
  
  getMyReports(params = {}) {
    return request.get('/reports/my', { params })
  }
}
