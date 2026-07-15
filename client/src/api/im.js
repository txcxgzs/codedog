import request from './request'

export const imApi = {
  createSsoTicket(action = {}) {
    return request.post('/users/im-sso-ticket', action)
  }
}
