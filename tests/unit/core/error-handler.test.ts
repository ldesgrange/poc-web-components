import { describe, it, expect, beforeEach, vi } from 'vitest'

import { ErrorHandler } from '../../../src/core/error-handler'
import { serviceRegistry } from '../../../src/core/service-registry'
import { SingleToastService, ToastService } from '../../../src/core/toast-service'

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler
  let mockListener: (message: string) => void
  serviceRegistry.set(ToastService, new SingleToastService())

  beforeEach(() => {
    vi.clearAllMocks()
    errorHandler = new ErrorHandler()
    mockListener = vi.fn()
    errorHandler.subscribe(mockListener)
  })

  it('should catch global window errors', () => {
    const error = new Error('Global test error')
    window.dispatchEvent(new ErrorEvent('error', {
      error: error,
      message: error.message,
    }))

    expect(mockListener).toHaveBeenCalledWith('Global test error')
  })

  it('should catch unhandled rejections', async () => {
    const reason = new Error('Unhandled promise rejection')

    // Avoid Vitest from failing due to unhandled rejection
    const p = Promise.reject(reason)
    p.catch(() => {}) // Swallow to avoid vitest error

    // Simulating unhandledrejection event
    const event = new PromiseRejectionEvent('unhandledrejection', {
      promise: p,
      reason: reason,
      cancelable: true,
    })
    window.dispatchEvent(event)

    expect(mockListener).toHaveBeenCalledWith('Unhandled promise rejection')
  })
})
