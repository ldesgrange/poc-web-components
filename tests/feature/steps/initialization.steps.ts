import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

import { generateMasterKey } from '../../../src/core/master-key-utils.js'
import { setupMasterKeyInPage } from '../support/test-utils.js'
import { CustomWorld } from '../support/world.js'

Given('a securely generated encryption key {string} in IndexedDB', async function (this: CustomWorld, stored: 'is stored' | 'is not stored') {
  const isStored = stored === 'is stored'
  const masterKeyData = isStored ? await generateMasterKey('default', 'correct-password') : undefined

  await setupMasterKeyInPage(this.page, masterKeyData)
})

When('the user provides a password and its confirmation', async function (this: CustomWorld) {
  const component = this.page.locator('app-initialization')
  await component.locator('input#password').fill('correct-password')
  await component.locator('input#confirm-password').fill('correct-password')
  await component.locator('button#submit-password').click()
})

When('the user provides mismatching password and confirmation', async function (this: CustomWorld) {
  const component = this.page.locator('app-initialization')
  await component.locator('input#password').fill('password123')
  await component.locator('input#confirm-password').fill('password456')
})

Then('an error message {string} is displayed', async function (this: CustomWorld, message: string) {
  const errorMessage = this.page.locator('app-initialization').locator(`.error.message:has-text("${message}")`)
  await expect(errorMessage).toBeVisible()
})

Then('the submit button is disabled', async function (this: CustomWorld) {
  const submitButton = this.page.locator('app-initialization').locator('button#submit-password')
  await expect(submitButton).toBeDisabled()
})

Then('the application asks the user to set-up a password', async function (this: CustomWorld) {
  const passwordPrompt = this.page.locator('app-initialization').locator('label:has-text("Enter your password")')
  await expect(passwordPrompt).toBeVisible()
})

Then('the application generates an encryption key and stores it password-encrypted in IndexedDB', async function (this: CustomWorld) {
  // Verify some UI sign of success if applicable.
  const successMessage = this.page.locator('app-toast').locator('text=Encryption key setup complete')
  await expect(successMessage).toBeVisible()

  // Verify that the key is now "stored".
  await this.page.waitForFunction(async () => {
    return new Promise((resolve) => {
      const request = indexedDB.open('master-key-db', 1)
      request.onsuccess = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('master-keys')) {
          db.close()
          resolve(false)
          return
        }
        const transaction = db.transaction('master-keys', 'readonly')
        const store = transaction.objectStore('master-keys')
        const getRequest = store.get('default')
        getRequest.onsuccess = () => {
          const result = getRequest.result
          db.close()
          resolve(!!result)
        }
        getRequest.onerror = () => {
          db.close()
          resolve(false)
        }
      }
      request.onerror = () => resolve(false)
    })
  })
})
