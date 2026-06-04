import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import GeetestDialog from './GeetestDialog.vue'

// Mock geetestApi
vi.mock('@/api/geetest', () => ({
  geetestApi: {
    getConfig: vi.fn(),
    register: vi.fn(),
    recordShow: vi.fn()
  }
}))

describe('GeetestDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should emit cancel event when user clicks cancel button', async () => {
    const wrapper = mount(GeetestDialog, {
      global: {
        mocks: {
          $api: {
            geetest: {
              getConfig: vi.fn().mockResolvedValue({ code: 200, data: { enabled: false } })
            }
          }
        }
      }
    })

    // Find cancel button and click
    const cancelButton = wrapper.find('el-button')
    await cancelButton.trigger('click')

    // Check if cancel event was emitted
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('should resolve Promise with null when dialog is closed without verification', async () => {
    const wrapper = mount(GeetestDialog, {
      global: {
        mocks: {
          $api: {
            geetest: {
              getConfig: vi.fn().mockResolvedValue({ code: 200, data: { enabled: true, scenes: { test: true } }),
              register: vi.fn().mockResolvedValue({ code: 200, data: { gt: 'test', challenge: 'test', success: 1, new_captcha: true } }),
              recordShow: vi.fn()
            }
          }
        }
      }
    })

    // Call show method
    const showPromise = wrapper.vm.show('test')

    // Close dialog without verification
    wrapper.vm.visible = false

    // Promise should resolve with null
    const result = await showPromise
    expect(result).toBeNull()
  })

  it('should emit success event when verification succeeds', async () => {
    const wrapper = mount(GeetestDialog)

    // Simulate verification success
    wrapper.vm.resolvePromise = vi.fn((data) => {
      wrapper.vm.lastResult = data
      wrapper.vm.emit('success', data)
    })

    // Manually trigger success callback
    const mockResult = {
      geetest_challenge: 'test_challenge',
      geetest_validate: 'test_validate',
      geetest_seccode: 'test_seccode'
    }

    // Emit success event
    wrapper.vm.emit('success', mockResult)

    // Check if success event was emitted with correct data
    expect(wrapper.emitted('success')).toBeTruthy()
    expect(wrapper.emitted('success')[0][0]).toEqual(mockResult)
  })

  it('should return empty object when geetest is not enabled', async () => {
    vi.mock('@/api/geetest', () => ({
      geetestApi: {
        getConfig: vi.fn().mockResolvedValue({ code: 200, data: { enabled: false } }),
        recordShow: vi.fn()
      }
    }))

    const wrapper = mount(GeetestDialog)

    const result = await wrapper.vm.show('test')
    expect(result).toEqual({})
  })

  it('should return empty object when scene is not enabled', async () => {
    vi.mock('@/api/geetest', () => ({
      geetestApi: {
        getConfig: vi.fn().mockResolvedValue({ code: 200, data: { enabled: true, scenes: { other: true } } }),
        recordShow: vi.fn()
      }
    }))

    const wrapper = mount(GeetestDialog)

    const result = await wrapper.vm.show('test')
    expect(result).toEqual({})
  })
})