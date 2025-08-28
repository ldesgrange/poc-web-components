import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

import { generateMasterKey } from '../../../src/core/master-key-utils.js'
import { setupMasterKeyInPage } from '../support/test-utils.js'
import { CustomWorld } from '../support/world.js'

Given('the user has unlocked the application with password {string}', async function (this: CustomWorld, password: string) {
  // 1. Setup the master key with the given password.
  const masterKeyData = await generateMasterKey('default', password)
  await setupMasterKeyInPage(this.page, masterKeyData)

  // 2. Load the app.
  await this.goto()

  // 3. Unlock it (if app-unlock is shown).
  try {
    const unlockComponent = this.page.locator('app-unlock')
    await expect(unlockComponent).toBeAttached({ timeout: 5000 })
    const unlockButton = unlockComponent.locator('button#submit-unlock')
    await unlockButton.waitFor({ state: 'visible', timeout: 5000 })
    await unlockComponent.locator('input#unlock-password').fill('correct-password')
    await unlockButton.click()
  } catch {
    // If not visible, maybe it's already unlocked or directly on task list.
  }

  await expect(this.page.locator('app-unlock')).not.toBeAttached()
})

Given('the user is on the task list page', async function (this: CustomWorld) {
  await expect(this.page.locator('app-task-list')).toBeAttached()
})

When('the user clicks on the settings icon', async function (this: CustomWorld) {
  const settingsButton = this.page.locator('app-root').locator('button#settings')
  await settingsButton.click()
})

Then('the settings dialog is displayed', async function (this: CustomWorld) {
  const settingsDialog = this.page.locator('app-settings').locator('dialog')
  await expect(settingsDialog).toBeVisible()
})

When('the user enters {string} in the {string} field', async function (this: CustomWorld, value: string, fieldLabel: string) {
  const settingsComponent = this.page.locator('app-settings')
  let selector = ''
  if (fieldLabel === 'New password') {
    selector = 'input#new-password'
  } else if (fieldLabel === 'Confirm new password') {
    selector = 'input#confirm-new-password'
  }
  await settingsComponent.locator(selector).fill(value)
})

When('the user clicks the {string} button', async function (this: CustomWorld, buttonLabel: string) {
  const settingsComponent = this.page.locator('app-settings')
  let selector = ''
  const target = settingsComponent

  if (buttonLabel === 'Change Password') {
    selector = 'button#submit-new-password'
  } else if (buttonLabel === 'Add WebAuthn Protection') {
    selector = 'button#add-webauthn'
  } else if (buttonLabel === 'Unlock with WebAuthn') {
    const unlockComponent = this.page.locator('app-unlock')
    await unlockComponent.evaluate((host) => {
      const button = host.shadowRoot?.querySelector('button#webauthn-unlock') as HTMLButtonElement | null
      if (button) button.click()
    })
    return
  }
  await target.locator(selector).click()
})

Then('a success message {string} is displayed', async function (this: CustomWorld, message: string) {
  const successMessage = this.page.locator('app-settings').locator(`.success.message:has-text("${message}")`)
  await expect(successMessage).toBeVisible()
})

Then('the settings dialog is closed', async function (this: CustomWorld) {
  await expect(this.page.locator('app-settings')).not.toBeAttached()
})

When('the user reloads the application', async function (this: CustomWorld) {
  await this.page.reload()
})

When('the user provides password {string}', async function (this: CustomWorld, password: string) {
  const unlockComponent = this.page.locator('app-unlock')
  await unlockComponent.waitFor({ state: 'attached' })
  const passwordInput = unlockComponent.locator('input#unlock-password')
  await passwordInput.fill(password)
  await passwordInput.press('Enter')
})

Then('the task list is displayed', async function (this: CustomWorld) {
  await expect(this.page.locator('app-task-list')).toBeAttached()
})

Then('the {string} button is disabled', async function (this: CustomWorld, buttonLabel: string) {
  const settingsComponent = this.page.locator('app-settings')
  let selector = ''
  if (buttonLabel === 'Change Password') {
    selector = 'button#submit-new-password'
  }
  await expect(settingsComponent.locator(selector)).toBeDisabled()
})

Then('a settings error message {string} is displayed', async function (this: CustomWorld, message: string) {
  const errorMessage = this.page.locator('app-settings').locator(`.error.message:has-text("${message}")`)
  await expect(errorMessage).toBeVisible()
})
