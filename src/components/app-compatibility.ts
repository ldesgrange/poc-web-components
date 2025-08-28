import { icon } from '@fortawesome/fontawesome-svg-core'

import {
  isIndexedDbApiAvailable, isPersistentStorageAvailable, isPersistentStoragePermissionGranted,
  isSecureContextAvailable, isStorageApiAvailable, requestPersistentStoragePermission,
  areCryptoPrimitivesAvailable,
} from '@app/core/compatibility-utils'
import { newDeferredPromise, sleep } from '@app/core/utils'
import { theme } from '@app/styles/theme'

import cssContent from './app-compatibility.css?raw'

const template = document.createElement('template')
template.innerHTML = `
<dialog aria-modal="true" closedby="none">
  <h1 role="heading">Compatibility check</h1>
  <ul id="items"></ul>
</dialog>
`

enum Status {
  WORKING = 'working',
  SUCCESS = 'success',
  FAILURE = 'failure',
}

interface StatusDetail {
  statusText: string;
  alertText?: string;
  alertActionText?: string;
  alertAction?: () => Promise<void>;
}

interface CheckItem {
  name: string,
  check: () => Promise<boolean>,
  texts: Record<Status, StatusDetail>
  currentStatus?: Status
}

/**
 * This component opens a dialog showing the progress of various checks to determine the browser's compatibility with the application.
 *
 * Usage:
 * ```
 * // Create the component:
 * const compatibilityComponent = document.createElement('app-compatibility') as AppCompatibility
 * // Add an event listener on the `close` event:
 * compatibilityComponent.addEventListener('close', () => {})
 * // Attach it:
 * this.root.appendChild(compatibilityComponent)
 * // Then display it:
 * compatibilityComponent.show()
 * ```
 * In the event listener, read the value of field `isCompatible`.
 */
export class AppCompatibility extends HTMLElement {
  /**
   * Number of milliseconds to wait during each “check” step.
   * This should be 0 in normal usage for minimal disruption.
   * Set at a non-zero value for a demo purpose.
   */
  private readonly SLEEP_TIME = 0

  private dialog!: HTMLDialogElement
  private itemsElement!: HTMLElement
  private onDialogCloseRef = this.onDialogClose.bind(this)
  private checkItems: CheckItem[] = [
    {
      name: 'secure-context',
      check: () => Promise.resolve(isSecureContextAvailable()),
      texts: {
        [Status.WORKING]: { statusText: 'Checking Secure Context…' },
        [Status.SUCCESS]: { statusText: 'Running in a Secure Context.' },
        [Status.FAILURE]: { statusText: 'NOT running in a Secure Context.', alertText: 'The application requires to be running in a Secure Context. Please use HTTPS or localhost.' },
      },
    },
    {
      name: 'crypto-primitives',
      check: () => areCryptoPrimitivesAvailable(),
      texts: {
        [Status.WORKING]: { statusText: 'Checking Crypto primitives availability…' },
        [Status.SUCCESS]: { statusText: 'Crypto primitives available.' },
        [Status.FAILURE]: { statusText: 'Crypto primitives NOT available.', alertText: 'The application requires a web browser that supports the required cryptographic primitives.' },
      },
    },
    {
      name: 'storage-api',
      check: () => Promise.resolve(isStorageApiAvailable()),
      texts: {
        [Status.WORKING]: { statusText: 'Checking Storage API availability…' },
        [Status.SUCCESS]: { statusText: 'Storage API available.' },
        [Status.FAILURE]: { statusText: 'Storage API NOT available.', alertText: 'The application requires a web browser that supports the Storage API.' },
      },
    },
    {
      name: 'persistent-storage',
      check: () => Promise.resolve(isPersistentStorageAvailable()),
      texts: {
        [Status.WORKING]: { statusText: 'Checking Persistent Storage availability…' },
        [Status.SUCCESS]: { statusText: 'Persistent Storage available.' },
        [Status.FAILURE]: { statusText: 'Persistent Storage NOT available.', alertText: 'The application requires a web browser that supports Persistent Storage.' },
      },
    },
    {
      name: 'indexed-db',
      check: () => Promise.resolve(isIndexedDbApiAvailable()),
      texts: {
        [Status.WORKING]: { statusText: 'Checking IndexedDB availability…' },
        [Status.SUCCESS]: { statusText: 'IndexedDB available.' },
        [Status.FAILURE]: { statusText: 'IndexedDB NOT available.', alertText: 'The application requires a web browser that supports IndexedDB.' },
      },
    },
    {
      name: 'persistent-storage-permission',
      check: () => isPersistentStoragePermissionGranted(),
      texts: {
        [Status.WORKING]: { statusText: 'Checking Persistent Storage permission…', alertText: 'Persistent Storage permission is required to prevent your data from being deleted.', alertActionText: 'Grant permission', alertAction: requestPersistentStoragePermission },
        [Status.SUCCESS]: { statusText: 'Persistent Storage permission granted.' },
        [Status.FAILURE]: { statusText: 'Persistent Storage permission NOT granted.', alertText: 'The application requires the Persistent Storage permission to be granted.' },
      },
    },
  ]

  /**
   * Indicates whether the current browser supports the required features.
   */
  public isCompatible = false

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
    this.itemsElement = this.shadowRoot!.getElementById('items')!
    this.dialog.addEventListener('close', this.onDialogCloseRef)
  }

  override disconnectedCallback() {
    this.dialog.removeEventListener('close', this.onDialogCloseRef)
  }

  private render() {
    this.itemsElement.innerHTML = ''
    this.checkItems
      .filter(item => item.currentStatus)
      .forEach(item => {
        const li = document.createElement('li')
        li.id = item.name

        const classes = item.currentStatus === Status.SUCCESS ? 'success' : item.currentStatus === Status.FAILURE ? 'danger' : 'fa-spin'
        const iconName = item.currentStatus === Status.SUCCESS ? 'square-check' : item.currentStatus === Status.FAILURE ? 'square-xmark' : 'cog'
        const details = item.texts[item.currentStatus!]

        li.innerHTML = `<i class="fa ${classes}">${icon({ prefix: 'fas', iconName: iconName }).html}</i>`
        if (details.statusText) {
          li.innerHTML += '<span role="status"></span>'
          li.querySelector('span')!.textContent = details.statusText
        }
        if (details.alertText) {
          li.innerHTML += '<div role="alert" class="warning message"></div>'
          li.querySelector('[role="alert"]')!.textContent = details.alertText
        }
        if (details.alertActionText) {
          li.innerHTML += `<button id="${item.name}-button"></button>`
          li.querySelector('button')!.textContent = details.alertActionText
        }

        this.itemsElement.appendChild(li)
      })
  }

  public show () {
    this.dialog.showModal()
    this.checkBrowserCapabilities()
      .then(isCompatible => this.isCompatible = isCompatible)
      .then(isCompatible => {
        if (isCompatible) this.dialog.close()
      })
  }

  private onDialogClose() {
    this.dispatchEvent(new Event('close'))
  }

  private async checkBrowserCapabilities(): Promise<boolean> {
    for (const checkItem of this.checkItems) {
      checkItem.currentStatus = Status.WORKING
      this.render()
      await sleep(this.SLEEP_TIME)

      let success = await checkItem.check()
      const action = checkItem.texts[checkItem.currentStatus].alertAction
      if (!success && action) {
        await this.waitForAction(checkItem, action)
        success = await checkItem.check()
      }
      checkItem.currentStatus = success ? Status.SUCCESS : Status.FAILURE
      this.render()
      await sleep(this.SLEEP_TIME)

      if (!success) return false
    }
    return true
  }

  private async waitForAction(item: CheckItem, action: () => Promise<void>): Promise<void> {
    const button = this.shadowRoot!.getElementById(`${item.name}-button`) as HTMLButtonElement
    const result = newDeferredPromise<void, void>()

    function handleEvent(_event: Event) {
      action().then(() => result.resolve())
    }

    button.addEventListener('click', handleEvent, { once: true })
    button.focus()
    return result.promise
  }
}

if (!customElements.get('app-compatibility')) {
  customElements.define('app-compatibility', AppCompatibility)
}
