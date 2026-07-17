import request from './request'

export const uploadApi = {
  image(file) {
    const data = new FormData()
    data.append('image', file)
    return request.post('/uploads/image', data, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 })
  }
}
