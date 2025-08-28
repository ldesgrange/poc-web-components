import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SingleToastService, ToastService } from '../../../src/core/toast-service'
import { Severity } from '../../../src/core/utils'

describe('ToastService', () => {
  let toastService: ToastService

  beforeEach(() => {
    toastService = new SingleToastService()
  })

  it('should call showToast on the registered component', () => {
    const mockComponent = {
      showToast: vi.fn(),
    }

    toastService.register(mockComponent)
    toastService.show('Hello World', Severity.INFO)

    expect(mockComponent.showToast).toHaveBeenCalledWith('Hello World', Severity.INFO)
  })

  it('should not throw if no component is registered', () => {
    expect(() => toastService.show('Hello World', Severity.INFO)).not.toThrow()
  })

  it('should update the registered component when register is called again', () => {
    const mockComponent1 = { showToast: vi.fn() }
    const mockComponent2 = { showToast: vi.fn() }

    toastService.register(mockComponent1)
    toastService.register(mockComponent2)
    toastService.show('Hello World', Severity.INFO)

    expect(mockComponent1.showToast).not.toHaveBeenCalled()
    expect(mockComponent2.showToast).toHaveBeenCalledWith('Hello World', Severity.INFO)
  })
})
