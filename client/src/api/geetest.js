import request from './request'

export const geetestApi = {
  getConfig: () => request.get('/geetest/config'),
  register: () => request.get('/geetest/register'),
  validate: (data) => request.post('/geetest/validate', data),
  recordShow: (scene) => request.post('/geetest/show', { scene })
}
