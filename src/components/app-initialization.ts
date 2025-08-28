import { DEFAULT_MASTER_KEY_ID, MasterKeyService } from '@app/core/master-key-service'
import { generateMasterKey } from '@app/core/master-key-utils'
import { inject } from '@app/core/service-registry'
import { ToastService } from '@app/core/toast-service'
import { Severity } from '@app/core/utils'
import { theme } from '@app/styles/theme'

import cssContent from './app-initialization.css?raw'

const template = document.createElement('template')
template.innerHTML = `
<dialog aria-modal="true" closedby="none">
  <h1 role="heading">Encryption Setup</h1>
  <div id="setup-content">
    <p>Enter your password to secure your encryption key.</p>
    <div class="input-group">
      <label for="password">Enter your password</label>
      <input type="password" id="password" />
    </div>
    <div class="input-group">
      <label for="confirm-password">Confirm your password</label>
      <input type="password" id="confirm-password" />
    </div>
    <div class="input-group">
      <button id="submit-password" disabled>Submit</button>
    </div>
  </div>
  <div id="status-message"></div>
</dialog>
`

/**
 * This component generates the initial encryption key, based on a password.
 */
export class AppInitialization extends HTMLElement {
  private masterKeyService = inject(MasterKeyService)
  private toastService = inject(ToastService)
  private dialog!: HTMLDialogElement
  private passwordInput!: HTMLInputElement
  private confirmPasswordInput!: HTMLInputElement
  private submitButton!: HTMLButtonElement
  private statusMessage!: HTMLElement

  private onSubmitClickRef = () => this.handlePasswordSubmit()
  private onPasswordInputRef = () => this.updateFormState()

  constructor() {
    super()
    const shadow = this.attachShadow({ mode: 'open' })
    const style = new CSSStyleSheet()
    style.replaceSync(cssContent)
    shadow.adoptedStyleSheets = [theme, style]
    shadow.appendChild(template.content.cloneNode(true))
  }

  override connectedCallback() {
    this.dialog = this.shadowRoot!.querySelector('dialog')!
    this.passwordInput = this.shadowRoot!.getElementById('password') as HTMLInputElement
    this.confirmPasswordInput = this.shadowRoot!.getElementById('confirm-password') as HTMLInputElement
    this.submitButton = this.shadowRoot!.getElementById('submit-password') as HTMLButtonElement
    this.statusMessage = this.shadowRoot!.getElementById('status-message')!

    this.submitButton.addEventListener('click', this.onSubmitClickRef)
    this.passwordInput.addEventListener('input', this.onPasswordInputRef)
    this.confirmPasswordInput.addEventListener('input', this.onPasswordInputRef)
  }

  override disconnectedCallback() {
    this.submitButton.removeEventListener('click', this.onSubmitClickRef)
    this.passwordInput.removeEventListener('input', this.onPasswordInputRef)
    this.confirmPasswordInput.removeEventListener('input', this.onPasswordInputRef)
  }

  public show() {
    this.dialog.showModal()
    this.checkEncryptionKey()
  }

  private async checkEncryptionKey() {
    // Check if the master key already exists.
    const key = await this.masterKeyService.getMasterKey()
    if (key) this.complete()
  }

  private updateFormState() {
    const password = this.passwordInput.value
    const confirmPassword = this.confirmPasswordInput.value

    const bothFilled = password.length > 0 && confirmPassword.length > 0
    const matches = password === confirmPassword

    if (bothFilled && !matches) {
      this.statusMessage.innerHTML = '<div class="error message">Passwords do not match.</div>'
    } else {
      this.statusMessage.innerHTML = ''
    }

    this.submitButton.disabled = !password || !matches
  }

  private async handlePasswordSubmit() {
    const password = this.passwordInput.value
    const confirmPassword = this.confirmPasswordInput.value
    if (!password || password !== confirmPassword) return

    this.submitButton.disabled = true
    this.statusMessage.textContent = 'Generating encryption key…'

    try {
      const masterKey = await generateMasterKey(DEFAULT_MASTER_KEY_ID, password)
      await this.masterKeyService.saveMasterKey(masterKey)
      this.toastService.show('Encryption key setup complete.', Severity.SUCCESS)
      this.complete()
    } catch (e) {
      this.statusMessage.innerHTML = '<div class="error message">Failed to set up encryption (<span id="error-details"></span>). Please try again.</div>'
      this.statusMessage.querySelector('#error-details')!.textContent = String(e)
      this.submitButton.disabled = false
    }
  }

  private complete() {
    this.dialog.close()
    this.dispatchEvent(new Event('complete'))
  }
}

if (!customElements.get('app-initialization')) {
  customElements.define('app-initialization', AppInitialization)
}
