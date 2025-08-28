import { Then, When } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

import { CustomWorld } from '../support/world.js'

When('a web browser and a PRF compatible WebAuthn dongle', async function (this: CustomWorld) {
  const mockFn = () => {
    Object.defineProperty(window, 'PublicKeyCredential', {
      value: function () {},
      configurable: true,
    })
    const pkc = window.PublicKeyCredential as unknown as {
      getClientCapabilities: () => Promise<Record<string, boolean>>
    }
    pkc.getClientCapabilities = async () => ({
      ['extension:prf']: true,
    })

    // Mock getExtensions to include 'prf'
    const credentials = navigator.credentials
    const originalCreate = credentials.create.bind(credentials)
    credentials.create = async (options: CredentialCreationOptions) => {
      // Handle registration (may or may not have prf extension requested)
      if (options.publicKey) {
        return {
          rawId: new Uint8Array([1, 2, 3, 4]).buffer,
          getClientExtensionResults: () => ({
            ['prf']: {
              enabled: true,
            },
          }),
        } as unknown as Credential
      }
      return originalCreate(options)
    }

    const originalGet = credentials.get.bind(credentials)
    credentials.get = async (options: CredentialRequestOptions) => {
      // Handle PRF evaluation during authentication
      const pubKey = options.publicKey
      if (pubKey && pubKey.extensions && pubKey.extensions['prf']) {
        return {
          getClientExtensionResults: () => ({
            ['prf']: {
              results: {
                first: new Uint8Array(32).fill(1).buffer,
              },
            },
          }),
        } as unknown as Credential
      }
      return originalGet(options)
    }
  }

  // Using both addInitScript (for reloads) and evaluate (for current page)
  await this.page.addInitScript(mockFn)
  await this.page.evaluate(mockFn)
})

Then('the WebAuthn protection section is visible', async function (this: CustomWorld) {
  // We need to trigger the mock BEFORE the component checks for support.
  // Since we use addInitScript in the step above, but the page might already be loaded,
  // we might need to reload or have called it earlier.
  // For the sake of this test, let's assume we can find the section.
  const settingsComponent = this.page.locator('app-settings')
  const webauthnSection = settingsComponent.locator('#webauthn-section')
  await expect(webauthnSection).toBeVisible()
})

When('the user clicks the {string} button in settings', async function (this: CustomWorld, buttonLabel: string) {
  const settingsComponent = this.page.locator('app-settings')
  let selector = ''
  if (buttonLabel === 'Add WebAuthn Protection') {
    selector = 'button#add-webauthn'
  }
  await settingsComponent.locator(selector).click()
})

Then('the {string} button is visible', async function (this: CustomWorld, buttonLabel: string) {
  let selector = ''
  let parent = this.page.locator('app-root')
  if (buttonLabel === 'Unlock with WebAuthn') {
    // For shadow DOM visibility, use a waitForFunction to ensure the section is unhidden
    await this.page.waitForFunction(() => {
      const host = document.querySelector('app-unlock') as HTMLElement | null
      const button = host?.shadowRoot?.querySelector('button#webauthn-unlock') as HTMLButtonElement | null
      if (!button) return false
      const section = host?.shadowRoot?.querySelector('#webauthn-unlock-section') as HTMLElement | null
      return !!section && getComputedStyle(section).display !== 'none'
    }, {}, { timeout: 10000 })
    selector = 'button#webauthn-unlock'
    parent = this.page.locator('app-unlock')
  }
  await expect(parent.locator(selector)).toBeVisible({ timeout: 10000 })
})

When('the user clicks the {string} button in unlock screen', async function (this: CustomWorld, buttonLabel: string) {
  const unlockComponent = this.page.locator('app-unlock')
  let selector = ''
  if (buttonLabel === 'Unlock with WebAuthn') {
    selector = 'button#webauthn-unlock'
  }
  await unlockComponent.locator(selector).click()
})
