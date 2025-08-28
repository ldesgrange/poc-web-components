@settings @webauthn
Feature: WebAuthn Protection
  As an authenticated user
  I want to be able to protect my application with a WebAuthn device
  So that I can unlock it with my security key or biometric sensor

  Background:
    Given a securely generated encryption key "is stored" in IndexedDB
      And the user has unlocked the application with password "initial-password"
      And the user is on the task list page

  @settings @webauthn @smoke
  Scenario: User adds WebAuthn protection successfully
    Given a web browser and a PRF compatible WebAuthn dongle
     When the user clicks on the settings icon
     Then the settings dialog is displayed
      And the WebAuthn protection section is visible
     When the user clicks the "Add WebAuthn Protection" button
     Then a success message "WebAuthn protection added successfully" is displayed
     When the user reloads the application
     Then the application asks the user to unlock it
     When the user clicks the "Unlock with WebAuthn" button
     Then the key is "unlocked"
      And the task list is displayed
