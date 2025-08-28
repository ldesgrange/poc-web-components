import { MasterKeyService } from '@app/core/master-key-service'
import { DEFAULT_MASTER_KEY_ID } from '@app/core/master-key-service'
import { getWebAuthnPRF, HKDF_SALT_LENGTH_BYTES, isWebAuthnPRFSupported, registerWebAuthn } from '@app/core/master-key-utils'
import { inject } from '@app/core/service-registry'
import { theme } from '@app/styles/theme'

import cssContent from './app-settings.css?raw'

const template = document.createElement('template')
template.innerHTML = `
<dialog aria-modal="true">
  <h1 role="heading">Settings</h1>
  <button class="close" aria-label="Close settings">×</button>
  <div id="settings-content">
    <section id="password-section">
      <h2>Change Password</h2>
      <p>Re-encrypt your master key with a new password.</p>
      <div class="input-group">
        <label for="new-password">New password</label>
        <input type="password" id="new-password" />
      </div>
      <div class="input-group">
        <label for="confirm-new-password">Confirm new password</label>
        <input type="password" id="confirm-new-password" />
      </div>
      <div class="input-group">
        <button id="submit-new-password" disabled>Change Password</button>
      </div>
    </section>
    <section id="webauthn-section" hidden>
      <h2>WebAuthn Protection</h2>
      <p>Add an extra layer of protection using your WebAuthn dongle (Security Key, TouchID, etc.).</p>
      <div class="input-group">
        <button id="add-webauthn">Add WebAuthn Protection</button>
      </div>
    </section>
  </div>
  <div id="status-message"></div>
</dialog>
`

export class AppSettings extends HTMLElement {
  public decryptedKey: CryptoKey | null = null
  private masterKeyService = inject(MasterKeyService)
  private dialog!: HTMLDialogElement
  private closeButton!: HTMLButtonElement
  private newPasswordInput!: HTMLInputElement
  private confirmNewPasswordInput!: HTMLInputElement
  private submitButton!: HTMLButtonElement
  private addWebAuthnButton!: HTMLButtonElement
  private statusMessage!: HTMLElement

  private onDialogCloseRef = () => this.dispatchEvent(new Event('close'))
  private onCloseClickRef = () => this.close()
  private onSubmitClickRef = () => this.handleChangePassword()
  private onAddWebAuthnClickRef = () => this.handleAddWebAuthn()
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
    this.closeButton = this.shadowRoot!.querySelector('.close') as HTMLButtonElement
    this.newPasswordInput = this.shadowRoot!.getElementById('new-password') as HTMLInputElement
    this.confirmNewPasswordInput = this.shadowRoot!.getElementById('confirm-new-password') as HTMLInputElement
    this.submitButton = this.shadowRoot!.getElementById('submit-new-password') as HTMLButtonElement
    this.addWebAuthnButton = this.shadowRoot!.getElementById('add-webauthn') as HTMLButtonElement
    this.statusMessage = this.shadowRoot!.getElementById('status-message')!

    this.closeButton.addEventListener('click', this.onCloseClickRef)
    this.submitButton.addEventListener('click', this.onSubmitClickRef)
    this.addWebAuthnButton.addEventListener('click', this.onAddWebAuthnClickRef)
    this.newPasswordInput.addEventListener('input', this.onPasswordInputRef)
    this.confirmNewPasswordInput.addEventListener('input', this.onPasswordInputRef)

    this.checkWebAuthnSupport()

    this.dialog.addEventListener('close', this.onDialogCloseRef)
  }

  override disconnectedCallback() {
    this.closeButton.removeEventListener('click', this.onCloseClickRef)
    this.submitButton.removeEventListener('click', this.onSubmitClickRef)
    this.addWebAuthnButton.removeEventListener('click', this.onAddWebAuthnClickRef)
    this.newPasswordInput.removeEventListener('input', this.onPasswordInputRef)
    this.confirmNewPasswordInput.removeEventListener('input', this.onPasswordInputRef)
    this.dialog.removeEventListener('close', this.onDialogCloseRef)
  }

  public show() {
    this.dialog.showModal()
  }

  public close() {
    this.dialog.close()
  }

  private updateFormState() {
    const password = this.newPasswordInput.value
    const confirmPassword = this.confirmNewPasswordInput.value

    const bothFilled = password.length > 0 && confirmPassword.length > 0
    const matches = password === confirmPassword

    if (bothFilled && !matches) {
      this.statusMessage.innerHTML = '<div class="error message">Passwords do not match.</div>'
    } else {
      this.statusMessage.innerHTML = ''
    }

    this.submitButton.disabled = !password || !matches
  }

  private async handleChangePassword() {
    const newPassword = this.newPasswordInput.value
    if (!newPassword || !this.decryptedKey) return

    this.submitButton.disabled = true
    this.statusMessage.textContent = 'Updating encryption key…'

    try {
      await this.masterKeyService.resetMasterKeyWrappingWithPassword(DEFAULT_MASTER_KEY_ID, this.decryptedKey, newPassword)
      this.statusMessage.innerHTML = '<div class="success message">Password changed successfully.</div>'
      this.newPasswordInput.value = ''
      this.confirmNewPasswordInput.value = ''

      setTimeout(() => {
        this.close()
      }, 1000)
    } catch (e) {
      this.statusMessage.innerHTML = '<div class="error message">Failed to change password (<span id="error-details"></span>).</div>'
      this.statusMessage.querySelector('#error-details')!.textContent = String(e)
      this.submitButton.disabled = false
    }
  }

  private async checkWebAuthnSupport() {
    if (await isWebAuthnPRFSupported()) {
      this.shadowRoot!.getElementById('webauthn-section')!.removeAttribute('hidden')
    }
  }

  private async handleAddWebAuthn() {
    if (!this.decryptedKey) return

    this.addWebAuthnButton.disabled = true
    this.statusMessage.textContent = 'Please interact with your WebAuthn device…'

    try {
      const rpId = window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname

      // 1. Register credential.
      const credentialId = await registerWebAuthn(rpId)

      // 2. Evaluate PRF with a fresh salt to derive the KEK.
      const prfSalt = crypto.getRandomValues(new Uint8Array(HKDF_SALT_LENGTH_BYTES)).buffer
      const prfKey = await getWebAuthnPRF(rpId, credentialId, prfSalt)

      // 3. Complete wrapping.
      await this.masterKeyService.resetMasterKeyWrappingWithWebAuthn(
        DEFAULT_MASTER_KEY_ID,
        this.decryptedKey,
        prfKey,
        credentialId,
        rpId,
        prfSalt,
      )

      this.statusMessage.innerHTML = '<div class="success message">WebAuthn protection added successfully.</div>'
    } catch (e) {
      this.statusMessage.innerHTML = '<div class="error message">Failed to add WebAuthn protection (<span id="error-details"></span>).</div>'
      this.statusMessage.querySelector('#error-details')!.textContent = String(e)
      this.addWebAuthnButton.disabled = false
    }
  }
}

if (!customElements.get('app-settings')) {
  customElements.define('app-settings', AppSettings)
}
