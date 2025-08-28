import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

import { assertUnreachable } from '../../../src/core/utils.js'
import { CustomWorld } from '../support/world.js'

Given('the user’s browser {string} run in a Secure Context', async function (this: CustomWorld, enabled: 'does' | 'doesn’t') {
  const isEnabled = enabled === 'does'
  if (!isEnabled) {
    // Force an insecure context by overriding window.isSecureContext.
    await this.page.addInitScript(() => {
      Object.defineProperty(window, 'isSecureContext', {
        configurable: true,
        get: () => false,
      })
    })
  }
})
Given('the user’s browser {string} have crypto required primitives', async function (this: CustomWorld, enabled: 'does' | 'doesn’t') {
  const isEnabled = enabled === 'does'
  if (!isEnabled) {
    // Disable Web Crypto by overriding window.crypto.subtle.
    await this.page.addInitScript(() => {
      Object.defineProperty(window.crypto, 'subtle', {
        configurable: true,
        get: () => undefined,
      })
    })
  }
})
Given('the user’s browser {string} have Storage API', async function (this: CustomWorld, enabled: 'does' | 'doesn’t') {
  const isEnabled = enabled === 'does'
  if (!isEnabled) {
    // Disable the Storage API by returning undefined from navigator.storage.
    await this.page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'storage', {
        configurable: true,
        get: () => undefined,
      })
    })
  }
})
Given('the user’s browser {string} have Persistent Storage', async function (this: CustomWorld, enabled: 'does' | 'doesn’t') {
  const isEnabled = enabled === 'does'
  if (!isEnabled) {
    // Disable the Persistent Storage by returning undefined from navigator.storage.persist.
    await this.page.addInitScript(() => {
      delete (StorageManager.prototype as Partial<StorageManager>).persist
    })
  }
})
Given('the application is {string} to use persistent storage', async function (this: CustomWorld, allowed: 'allowed' | 'not allowed') {
  const isAllowed = allowed === 'allowed'
  // Simulate persistent storage being allowed/denied by returning true/false from navigator.storage.persisted.
  await this.page.addInitScript((value: boolean) => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      writable: true,
      value: {
        persisted: () => Promise.resolve(value),
        persist: () => Promise.resolve(value),
      },
    })
  }, isAllowed)
})
Given('the user’s browser {string} have IndexedDB', async function (this: CustomWorld, enabled: 'does' | 'doesn’t') {
  const isEnabled = enabled === 'does'
  if (!isEnabled) {
    // Disable IndexedDB by returning undefined from window.indexedDB.
    await this.page.addInitScript(() => {
      Object.defineProperty(window, 'indexedDB', {
        configurable: true,
        get: () => undefined,
      })
    })
  }
})
Given('the user has loaded the application', async function (this: CustomWorld) {
  await this.goto(`${this.parameters.baseUrl}/`)
})

When('the user loads the application', async function (this: CustomWorld) {
  await this.goto(`${this.parameters.baseUrl}/`)
})
When('the user {string} persistent storage', async function (this: CustomWorld, action: 'grants' | 'denies') {
  const isGranted = action === 'grants'
  // Simulate granting/denying persistent storage when the app calls the StorageManager.
  await this.page.evaluate((value: boolean) => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      writable: true,
      value: {
        persisted: () => Promise.resolve(value),
        persist: () => Promise.resolve(value),
      },
    })
  }, isGranted)
  await this.page.locator('app-compatibility').locator('#persistent-storage-permission-button').click()
})

Then('the application informs the user that the Storage API is {string}', async function (this: CustomWorld, available: 'available' | 'not available') {
  const isAvailable = available === 'available'
  const statusText = this.page.locator('app-compatibility').locator('#storage-api [role="status"]')
  await expect(statusText).toHaveText(isAvailable ? 'Storage API available.' : 'Storage API NOT available.')
})
Then('the application informs the user that Persistent Storage is {string}', async function (this: CustomWorld, available: 'available' | 'not available') {
  const isAvailable = available === 'available'
  const statusText = this.page.locator('app-compatibility').locator('#persistent-storage [role="status"]')
  await expect(statusText).toHaveText(isAvailable ? 'Persistent Storage available.' : 'Persistent Storage NOT available.')
})
Then('the application informs the user to use a web browser supporting {string}', async function (this: CustomWorld, api: 'Storage API' | 'Persistent Storage' | 'IndexedDB') {
  const alertText = this.page.locator('app-compatibility').locator('[role="alert"]')
  switch (api) {
    case 'Storage API':
      await expect(alertText).toHaveText('The application requires a web browser that supports the Storage API.')
      break
    case 'Persistent Storage':
      await expect(alertText).toHaveText('The application requires a web browser that supports Persistent Storage.')
      break
    case 'IndexedDB':
      await expect(alertText).toHaveText('The application requires a web browser that supports IndexedDB.')
      break
    default:
      assertUnreachable(api)
  }
})
Then('the application informs the user that IndexedDB is {string}', async function (this: CustomWorld, available: 'available' | 'not available') {
  const isAvailable = available === 'available'
  const statusText = this.page.locator('app-compatibility').locator('#indexed-db [role="status"]')
  await expect(statusText).toHaveText(isAvailable ? 'IndexedDB available.' : 'IndexedDB NOT available.')
})
Then('the application informs the user that it is {string} in a Secure Context', async function (this: CustomWorld, running: 'running' | 'not running') {
  const isRunning = running === 'running'
  const statusText = this.page.locator('app-compatibility').locator('#secure-context [role="status"]')
  await expect(statusText).toHaveText(isRunning ? 'Running in a Secure Context.' : 'NOT running in a Secure Context.')
})
Then('the application informs the user to run the application over HTTPS', async function (this: CustomWorld) {
  const alertText = this.page.locator('app-compatibility').locator('#secure-context [role="alert"]')
  await expect(alertText).toHaveText('The application requires to be running in a Secure Context. Please use HTTPS or localhost.')
})
Then('the application informs the user that persistent storage permission is {string}', async function (this: CustomWorld, state: 'granted' | 'not granted') {
  const isGranted = state === 'granted'
  const locator = this.page.locator('app-compatibility').locator('#persistent-storage-permission [role="status"]')
  const expectedText = isGranted ? 'Persistent Storage permission granted.' : 'Persistent Storage permission NOT granted.'

  if (isGranted) {
    // If we expect it to be granted, it might close very fast.
    // We wait for either the text to be correct OR the dialog to be hidden/detached.
    await expect(async () => {
      const isVisible = await this.page.locator('app-compatibility dialog').isVisible()
      if (!isVisible) return
      await expect(locator).toHaveText(expectedText, { timeout: 500 })
    }).toPass({ timeout: 5000 })
  } else {
    await expect(locator).toHaveText(expectedText)
  }
})
Then('the application {string} a permission request button', async function (this: CustomWorld, showButton: 'shows' | 'does not show') {
  const isVisible = showButton === 'shows'
  const persistButton = this.page.locator('app-compatibility').locator('#persistent-storage-permission-button')
  await expect(persistButton).toBeVisible({ visible: isVisible })
})
Then('the application explains why persistent storage permission is required', async function (this: CustomWorld) {
  const alertText = this.page.locator('app-compatibility').locator('#persistent-storage-permission [role="alert"]')
  await expect(alertText).toHaveText('Persistent Storage permission is required to prevent your data from being deleted.')
})
Then('the application informs the user to grant persistent storage permission', async function (this: CustomWorld) {
  const alertText = this.page.locator('app-compatibility').locator('#persistent-storage-permission [role="alert"]')
  await expect(alertText).toHaveText('The application requires the Persistent Storage permission to be granted.')
})
Then('the application informs the user that the required crypto primitives are {string}', async function (this: CustomWorld, available: 'available' | 'not available') {
  const isAvailable = available === 'available'
  const statusText = this.page.locator('app-compatibility').locator('#crypto-primitives [role="status"]')
  await expect(statusText).toHaveText(isAvailable ? 'Crypto primitives available.' : 'Crypto primitives NOT available.', { timeout: 10000 })
})
