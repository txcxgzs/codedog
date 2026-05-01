import request from './request'

export const hcaptchaApi = {
  getConfig() {
    return request.get('/hcaptcha/config')
  },
  
  verify(token, scene) {
    return request.post('/hcaptcha/verify', { token, scene })
  },
  
  getStatus() {
    return request.get('/hcaptcha/status')
  },
  
  recordShow(scene) {
    return request.post('/hcaptcha/show', { scene })
  }
}
