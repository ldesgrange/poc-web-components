import { inject } from '@app/core/service-registry'
import { ToastListener, ToastService } from '@app/core/toast-service'
import { Severity } from '@app/core/utils'
import { theme } from '@app/styles/theme'

import cssContent from './app-toast.css?raw'

const template = document.createElement('template')
template.innerHTML = `
<div class="toast-container" id="toast-container"></div>
`

const FIVE_SECONDS = 5000

export class AppToast extends HTMLElement implements ToastListener {
  private container!: HTMLElement
  private toastService = inject(ToastService)

  constructor() {
    super()
    const shadow = this.attachShadow({ mode: 'open' })
    const style = new CSSStyleSheet()
    style.replaceSync(cssContent)
    shadow.adoptedStyleSheets = [theme, style]
    shadow.appendChild(template.content.cloneNode(true))
    this.container = shadow.getElementById('toast-container')!

    this.toastService.register(this)
  }

  public showToast(message: string, severity: Severity): void {
    const toast = document.createElement('div')
    toast.className = `toast ${severity} message`
    toast.setAttribute('role', 'alert')
    toast.innerHTML = `
      <span class="toast-text"></span>
      <button class="close ${severity}">×</button>
    `
    toast.querySelector('.toast-text')!.textContent = message

    const closeButton = toast.querySelector('.close')!
    closeButton.addEventListener('click', () => {
      this.container.removeChild(toast)
    })

    // Auto-dismiss after a while.
    setTimeout(() => {
      if (this.container.contains(toast)) {
        this.container.removeChild(toast)
      }
    }, FIVE_SECONDS)

    this.container.appendChild(toast)
  }
}

if (!customElements.get('app-toast')) {
  customElements.define('app-toast', AppToast)
}
