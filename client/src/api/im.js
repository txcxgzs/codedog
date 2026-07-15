import request from './request'

export const imApi = {
  createSsoTicket() {
    return request.post('/users/im-sso-ticket')
  }
}
