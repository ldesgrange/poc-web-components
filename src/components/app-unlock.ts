import { MasterKeyService } from '@app/core/master-key-service'
import { DEFAULT_MASTER_KEY_ID } from '@app/core/master-key-service'
import { WebAuthnWrappedKey } from '@app/core/master-key-types'
import { getWebAuthnPRF } from '@app/core/master-key-utils'
import { inject } from '@app/core/service-registry'
import { theme } from '@app/styles/theme'

import cssContent from './app-unlock.css?raw'

const template = document.createElement('template')
template.innerHTML = `
<dialog aria-modal="true" closedby="none">
  <h1 role="heading">Unlock Application</h1>
  <div id="unlock-content">
    <section id="password-unlock-section">
      <p>Enter your password to unlock your encryption key.</p>
      <div class="input-group">
        <label for="unlock-password">Enter your password</label>
        <input type="password" id="unlock-password" />
      </div>
      <div class="input-group">
        <button id="password-unlock">Unlock</button>
      </div>
    </section>
    <section id="webauthn-unlock-section" hidden>
      <p>Or use your WebAuthn device:</p>
      <div class="input-group">
        <button id="webauthn-unlock">Unlock with WebAuthn</button>
      </div>
    </section>
  </div>
  <div id="status-message"></div>
</dialog>
`

export class AppUnlock extends HTMLElement {
  public unlockedKey: CryptoKey | null = null
  private masterKeyService = inject(MasterKeyService)
  private dialog!: HTMLDialogElement
  private passwordInput!: HTMLInputElement
  private passwordUnlockButton!: HTMLButtonElement
  private webauthnUnlockButton!: HTMLButtonElement
  private statusMessage!: HTMLElement

  private onPasswordUnlockClickRef = () => this.handlePasswordUnlock()
  private onWebAuthnUnlockClickRef = () => this.handleWebAuthnUnlock()
  private onPasswordKeyDownRef = (e: KeyboardEvent) => {
    if (e.key === 'Enter') this.handlePasswordUnlock()
  }

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
    this.passwordInput = this.shadowRoot!.getElementById('unlock-password') as HTMLInputElement
    this.passwordUnlockButton = this.shadowRoot!.getElementById('password-unlock') as HTMLButtonElement
    this.webauthnUnlockButton = this.shadowRoot!.getElementById('webauthn-unlock') as HTMLButtonElement
    this.statusMessage = this.shadowRoot!.getElementById('status-message')!

    this.passwordUnlockButton.addEventListener('click', this.onPasswordUnlockClickRef)
    this.webauthnUnlockButton.addEventListener('click', this.onWebAuthnUnlockClickRef)
    this.passwordInput.addEventListener('keydown', this.onPasswordKeyDownRef)

    this.checkWebAuthnAvailability()
  }

  override disconnectedCallback() {
    this.passwordUnlockButton.removeEventListener('click', this.onPasswordUnlockClickRef)
    this.webauthnUnlockButton.removeEventListener('click', this.onWebAuthnUnlockClickRef)
    this.passwordInput.removeEventListener('keydown', this.onPasswordKeyDownRef)
  }

  public show() {
    this.dialog.showModal()
  }

  private async handlePasswordUnlock() {
    const password = this.passwordInput.value
    if (!password) return

    this.passwordUnlockButton.disabled = true
    this.statusMessage.innerHTML = ''

    try {
      this.unlockedKey = await this.masterKeyService.getMasterKeyFromPassword(DEFAULT_MASTER_KEY_ID, password)
      this.statusMessage.innerHTML = '<div class="success message">Key unlocked successfully.</div>'

      this.complete()
    } catch {
      this.statusMessage.innerHTML = '<div class="error message">Invalid password.</div>'
      this.passwordUnlockButton.disabled = false
    }
  }

  private async checkWebAuthnAvailability() {
    const masterKey = await this.masterKeyService.getMasterKey(DEFAULT_MASTER_KEY_ID)
    const hasWebAuthn = masterKey?.wrappedKeys.some(k => k.type === 'webauthn')
    if (hasWebAuthn) {
      this.shadowRoot!.getElementById('webauthn-unlock-section')!.removeAttribute('hidden')
    }
  }

  public async handleWebAuthnUnlock() {
    this.webauthnUnlockButton.disabled = true
    this.statusMessage.innerHTML = 'Please interact with your WebAuthn device…'

    try {
      const masterKey = await this.masterKeyService.getMasterKey(DEFAULT_MASTER_KEY_ID)
      const webauthnKey = masterKey?.wrappedKeys.find(k => k.type === 'webauthn') as WebAuthnWrappedKey
      if (!webauthnKey) throw new Error('No WebAuthn key found.')

      const prfKey = await getWebAuthnPRF(webauthnKey.relyingPartyId, webauthnKey.credentialId, webauthnKey.prfSalt)
      this.unlockedKey = await this.masterKeyService.getMasterKeyFromWebAuthn(DEFAULT_MASTER_KEY_ID, prfKey)

      this.statusMessage.innerHTML = '<div class="success message">Key unlocked successfully</div>'
      // Use a custom event to notify completion and ensure it's synchronous for the test.
      this.complete()
    } catch (e: unknown) {
      const message = e && typeof e === 'object' && 'message' in e ? e.message : e
      this.statusMessage.innerHTML = '<div class="error message">WebAuthn unlock failed (<span id="error-details"></span>).</div>'
      this.statusMessage.querySelector('#error-details')!.textContent = String(message)
      this.webauthnUnlockButton.disabled = false
    }
  }

  private complete() {
    this.dialog.close()
    this.dispatchEvent(new Event('complete'))
  }
}

if (!customElements.get('app-unlock')) {
  customElements.define('app-unlock', AppUnlock)
}
