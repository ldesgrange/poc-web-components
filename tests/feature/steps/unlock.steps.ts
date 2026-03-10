import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

import { CustomWorld } from '../support/world.js'

// Note: "Given a securely generated encryption key {string} in IndexedDB" is already defined in initialization.steps.ts.

Given('the key has not been unlocked', async function (this: CustomWorld) {
  // For now, we'll assume the default state of a stored key is locked.
})

Then('the application asks the user to unlock it', async function (this: CustomWorld) {
  const component = this.page.locator('app-unlock')
  await component.waitFor({ state: 'attached' })

  const passwordInput = component.locator('input#unlock-password')
  await passwordInput.waitFor({ state: 'attached' })
})

When('the user provides {string} password', async function (this: CustomWorld, validity: 'a valid' | 'an invalid') {
  const component = this.page.locator('app-unlock')
  const password = validity === 'a valid' ? 'correct-password' : 'wrong-password'

  const passwordInput = component.locator('input#unlock-password')
  await passwordInput.fill(password)
  await component.locator('button#password-unlock').click()
})

Then('the key is {string}', async function (this: CustomWorld, status: 'unlocked' | 'not unlocked') {
  if (status === 'unlocked') {
    // Check for some UI indication that the app is unlocked and ready.
    // Assuming app-unlock is gone.
    const unlockComponent = this.page.locator('app-unlock')

    const statusMessage = unlockComponent.locator('#status-message')
    const error = statusMessage.locator('.error.message')
    if (await error.isVisible()) {
      const msg = await error.textContent()
      throw new Error(`Unlock failed with error: ${msg}`)
    }
    await expect(unlockComponent).not.toBeAttached({ timeout: 10000 })
  } else {
    // Check that we are still on the unlock screen.
    const component = this.page.locator('app-unlock')
    await expect(component).toBeAttached()
  }
})

Then('a key-related error message {string} is displayed', async function (this: CustomWorld, message: string) {
  const errorMessage = this.page.locator('app-unlock').locator(`.error.message:has-text("${message}")`)
  await expect(errorMessage).toBeVisible({ timeout: 10000 })
})
