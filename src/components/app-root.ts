import { icon } from '@fortawesome/fontawesome-svg-core'

import { inject } from '@app/core/service-registry'
import { StorageService } from '@app/core/storage-service'
import { ToastService } from '@app/core/toast-service'
import { Severity } from '@app/core/utils'
import { theme } from '@app/styles/theme.js'

import { AppCompatibility } from './app-compatibility'
import { AppInitialization } from './app-initialization'
import cssContent from './app-root.css?raw'
import { AppSettings } from './app-settings'
import { AppTaskList } from './app-task-list'
import { AppUnlock } from './app-unlock'

import './app-compatibility'
import './app-initialization'
import './app-settings'
import './app-task-list'
import './app-toast'
import './app-unlock'

const template = document.createElement('template')
template.innerHTML = `
<header>
  <h1>TASKS</h1>
  <button id="settings" aria-label="Settings" hidden>
    <i class="fa">${icon({ prefix: 'fas', iconName: 'cog' }).html}</i>
  </button>
</header>
<div id="content-area"></div>
<footer></footer>
`

export class AppRoot extends HTMLElement {
  private storageService = inject(StorageService)
  private toastService = inject(ToastService)
  private contentArea!: HTMLElement
  private footer!: HTMLElement
  private browserCompatibilityChecked = false
  private browserIsCompatible = false
  private initialized = false
  private unlocked = false
  private masterKey: CryptoKey | null = null

  private errorUnsubscribe?: () => void
  private onUpdateAvailableRef = () => {
    this.toastService.show('New version available! Please refresh.', Severity.INFO)
  }

  constructor() {
    super()
    const shadow = this.attachShadow({ mode: 'open' })
    const style = new CSSStyleSheet()
    style.replaceSync(cssContent)
    shadow.adoptedStyleSheets = [theme, style]
    shadow.appendChild(template.content.cloneNode(true))
  }

  override async connectedCallback() {
    this.setupPwaListeners()

    this.contentArea = this.shadowRoot!.getElementById('content-area')!
    this.footer = this.shadowRoot!.querySelector('footer')!

    await this.render()
  }

  override disconnectedCallback() {
    this.errorUnsubscribe?.()
    window.removeEventListener('app-update-available', this.onUpdateAvailableRef)
  }

  private setupPwaListeners() {
    window.addEventListener('app-update-available', this.onUpdateAvailableRef)
  }

  private async render() {
    this.footer.appendChild(document.createElement('app-toast'))
    this.browserIsCompatible = await this.checkCompatibility()
    if (!this.browserIsCompatible) return

    this.initialized = await this.showInitialization()
    if (!this.initialized) return

    this.unlocked = await this.unlockMasterKey()
    if (!this.unlocked || !this.masterKey) return
    this.storageService.open({ encryptionKey: this.masterKey })

    this.showTaskList()
    this.showSettingsButton()
  }

  private showSettingsButton() {
    const button = this.shadowRoot!.getElementById('settings')
    if (button) {
      button.removeAttribute('hidden')
      button.onclick = () => this.showSettings()
    }
  }

  private showSettings() {
    const settingsComponent = document.createElement('app-settings') as AppSettings
    settingsComponent.decryptedKey = this.masterKey
    this.contentArea.appendChild(settingsComponent)
    settingsComponent.show()
    settingsComponent.addEventListener('close', () => {
      if (this.contentArea.contains(settingsComponent)) this.contentArea.removeChild(settingsComponent)
    })
  }

  private checkCompatibility(): Promise<boolean> {
    if (this.browserCompatibilityChecked) return Promise.resolve(this.browserIsCompatible)

    this.browserCompatibilityChecked = true
    const compatibilityComponent = document.createElement('app-compatibility') as AppCompatibility
    const result = new Promise<boolean>((resolve) => {
      compatibilityComponent.addEventListener('close', () => {
        // The dialog window is closed, remove the compatibility component from the DOM.
        if (this.contentArea.contains(compatibilityComponent)) this.contentArea.removeChild(compatibilityComponent)
        resolve(compatibilityComponent.isCompatible)
      })
    })
    this.contentArea.appendChild(compatibilityComponent)
    compatibilityComponent.show()
    return result
  }

  private showInitialization(): Promise<boolean> {
    const initializationComponent = document.createElement('app-initialization') as AppInitialization
    const result = new Promise<boolean>((resolve) => {
      initializationComponent.addEventListener('complete', () => {
        // Only remove if it's actually in the root (might have been auto-completed).
        if (this.contentArea.contains(initializationComponent)) this.contentArea.removeChild(initializationComponent)
        resolve(true)
      })
    })
    this.contentArea.appendChild(initializationComponent)
    initializationComponent.show()
    return result
  }

  private async unlockMasterKey(): Promise<boolean> {
    const unlockComponent = document.createElement('app-unlock') as AppUnlock
    const result = new Promise<boolean>((resolve) => {
      unlockComponent.addEventListener('complete', () => {
        this.masterKey = unlockComponent.unlockedKey
        if (this.contentArea.contains(unlockComponent)) this.contentArea.removeChild(unlockComponent)
        resolve(true)
      })
    })
    this.contentArea.appendChild(unlockComponent)
    unlockComponent.show()
    return result
  }

  private showTaskList() {
    if (this.contentArea.querySelector('app-task-list')) return
    const taskList = document.createElement('app-task-list') as AppTaskList
    this.contentArea.appendChild(taskList)
  }
}
