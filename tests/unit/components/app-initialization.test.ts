import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest'

import '../../../src/components/app-initialization'
import { AppInitialization } from '../../../src/components/app-initialization'
import { MasterKeyService } from '../../../src/core/master-key-service'
import { generateMasterKey } from '../../../src/core/master-key-utils'
import { serviceRegistry } from '../../../src/core/service-registry'
import { ToastService } from '../../../src/core/toast-service'
import { Severity } from '../../../src/core/utils'

// Mock masterKeyService methods
const mockListMasterKeys = vi.fn().mockResolvedValue([])
const mockSaveMasterKey = vi.fn().mockResolvedValue(undefined)
const mockGetMasterKey = vi.fn().mockResolvedValue(undefined)
const mockGetMasterKeyFromPassword = vi.fn().mockResolvedValue(undefined)
const mockGetMasterKeyFromWebAuthn = vi.fn().mockResolvedValue(undefined)

const mockMasterKeyService: MasterKeyService = {
  listMasterKeys: mockListMasterKeys,
  saveMasterKey: mockSaveMasterKey,
  getMasterKey: mockGetMasterKey,
  getMasterKeyFromPassword: mockGetMasterKeyFromPassword,
  getMasterKeyFromWebAuthn: mockGetMasterKeyFromWebAuthn,
  resetMasterKeyWrappingWithPassword: vi.fn().mockResolvedValue(undefined),
  resetMasterKeyWrappingWithWebAuthn: vi.fn(),
  deleteMasterKey: vi.fn(),
  close: vi.fn(),
}
const mockToastService: ToastService = {
  show: vi.fn().mockResolvedValue(undefined),
  register: vi.fn().mockResolvedValue(undefined),
}
vi.mock('../../../src/core/master-key-utils', () => ({
  generateMasterKey: vi.fn().mockResolvedValue(undefined),
}))

// Stub dialog methods for jsdom
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  })
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  })
})

describe('AppInitialization', () => {
  let element: AppInitialization

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    serviceRegistry.set(MasterKeyService, mockMasterKeyService)
    serviceRegistry.set(ToastService, mockToastService)

    // Create element
    element = document.createElement('app-initialization') as AppInitialization
    document.body.appendChild(element)
  })

  afterEach(() => {
    document.body.removeChild(element)
  })

  it('should show the dialog when show() is called', () => {
    const dialog = element.shadowRoot!.querySelector('dialog')!
    vi.spyOn(dialog, 'showModal')

    element.show()

    expect(dialog.showModal).toHaveBeenCalled()
  })

  it('should complete automatically if a key already exists', async () => {
    mockGetMasterKey.mockResolvedValue({
      id: 'existing',
      version: 0,
      createdAt: 0,
      wrappedKeys: [],
    })

    const completeSpy = vi.fn()
    element.addEventListener('complete', completeSpy)

    element.show()

    // Wait for async checkEncryptionKey
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(completeSpy).toHaveBeenCalled()
  })

  it('should generate and store a key when password and confirmation match', async () => {
    element.show()

    const passwordInput = element.shadowRoot!.getElementById('password') as HTMLInputElement
    const confirmInput = element.shadowRoot!.getElementById('confirm-password') as HTMLInputElement
    const submitButton = element.shadowRoot!.getElementById('submit-password') as HTMLButtonElement
    const statusMessage = element.shadowRoot!.getElementById('status-message')!

    passwordInput.value = 'test-password'
    confirmInput.value = 'test-password'
    passwordInput.dispatchEvent(new Event('input'))
    confirmInput.dispatchEvent(new Event('input'))

    const completeSpy = vi.fn()
    element.addEventListener('complete', completeSpy)

    expect(submitButton.disabled).toBe(false)
    submitButton.click()

    expect(submitButton.disabled).toBe(true)
    expect(statusMessage.textContent).toBe('Generating encryption key…')

    // Wait for the async crypto operations and setTimeout
    await vi.waitFor(() => {
      expect(generateMasterKey).toHaveBeenCalledWith('default', 'test-password')
    }, { timeout: 1000 })
    await vi.waitFor(() => {
      expect(mockSaveMasterKey).toHaveBeenCalled()
    }, { timeout: 1000 })

    expect(mockToastService.show).toHaveBeenCalledWith('Encryption key setup complete.', Severity.SUCCESS)

    // Wait for the setTimeout in handlePasswordSubmit
    await vi.waitFor(() => {
      expect(completeSpy).toHaveBeenCalled()
    }, { timeout: 1000 })
  })

  it('should show error message if passwords do not match', async () => {
    element.show()

    const passwordInput = element.shadowRoot!.getElementById('password') as HTMLInputElement
    const confirmInput = element.shadowRoot!.getElementById('confirm-password') as HTMLInputElement
    const submitButton = element.shadowRoot!.getElementById('submit-password') as HTMLButtonElement
    const statusMessage = element.shadowRoot!.getElementById('status-message')!

    passwordInput.value = 'test-password'
    confirmInput.value = 'wrong-password'
    passwordInput.dispatchEvent(new Event('input'))
    confirmInput.dispatchEvent(new Event('input'))

    expect(statusMessage.innerHTML).toContain('Passwords do not match')
    expect(submitButton.disabled).toBe(true)

    submitButton.click()

    expect(generateMasterKey).not.toHaveBeenCalled()
    expect(mockSaveMasterKey).not.toHaveBeenCalled()
  })

  it('should disable submit button when inputs are empty', () => {
    element.show()
    const passwordInput = element.shadowRoot!.getElementById('password') as HTMLInputElement
    const confirmInput = element.shadowRoot!.getElementById('confirm-password') as HTMLInputElement
    const submitButton = element.shadowRoot!.getElementById('submit-password') as HTMLButtonElement

    expect(submitButton.disabled).toBe(true)

    passwordInput.value = 'abc'
    passwordInput.dispatchEvent(new Event('input'))
    expect(submitButton.disabled).toBe(true)

    confirmInput.value = 'def'
    confirmInput.dispatchEvent(new Event('input'))
    expect(submitButton.disabled).toBe(true)

    confirmInput.value = 'abc'
    confirmInput.dispatchEvent(new Event('input'))
    expect(submitButton.disabled).toBe(false)
  })

  it('should only show error when both fields have content and do not match', () => {
    element.show()
    const passwordInput = element.shadowRoot!.getElementById('password') as HTMLInputElement
    const confirmInput = element.shadowRoot!.getElementById('confirm-password') as HTMLInputElement
    const statusMessage = element.shadowRoot!.getElementById('status-message')!

    passwordInput.value = 'abc'
    passwordInput.dispatchEvent(new Event('input'))
    expect(statusMessage.innerHTML).toBe('')

    confirmInput.value = 'def'
    confirmInput.dispatchEvent(new Event('input'))
    expect(statusMessage.innerHTML).toContain('Passwords do not match')

    passwordInput.value = ''
    passwordInput.dispatchEvent(new Event('input'))
    expect(statusMessage.innerHTML).toBe('')
  })

  it('should show error message if key generation fails', async () => {
    mockSaveMasterKey.mockRejectedValue(new Error('Storage failed'))

    element.show()

    const passwordInput = element.shadowRoot!.getElementById('password') as HTMLInputElement
    const confirmInput = element.shadowRoot!.getElementById('confirm-password') as HTMLInputElement
    const submitButton = element.shadowRoot!.getElementById('submit-password') as HTMLButtonElement
    const statusMessage = element.shadowRoot!.getElementById('status-message')!

    passwordInput.value = 'test-password'
    confirmInput.value = 'test-password'
    passwordInput.dispatchEvent(new Event('input'))
    confirmInput.dispatchEvent(new Event('input'))

    submitButton.click()

    await vi.waitFor(() => {
      expect(statusMessage.innerHTML).toContain('Failed to set up encryption')
    })

    expect(submitButton.disabled).toBe(false)
  })
})
