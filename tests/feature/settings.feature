@settings
Feature: Application settings
  As an authenticated user
  I want to be able to change my password
  So that I can keep my encryption key secure

  Background:
    Given a securely generated encryption key "is stored" in IndexedDB
      And the user has unlocked the application with password "initial-password"
      And the user is on the task list page

  @settings @smoke
  Scenario: User changes the application password successfully
    When the user clicks on the settings icon
    Then the settings dialog is displayed
    When the user enters "new-secure-password" in the "New password" field
     And the user enters "new-secure-password" in the "Confirm new password" field
     And the user clicks the "Change Password" button
    Then a success message "Password changed successfully" is displayed
     And the settings dialog is closed
    When the user reloads the application
    Then the application asks the user to unlock it
    When the user provides password "initial-password"
    Then the key is "not unlocked"
    When the user provides password "new-secure-password"
    Then the key is "unlocked"
     And the task list is displayed

  @settings
  Scenario: User provides mismatching passwords
    When the user clicks on the settings icon
    Then the settings dialog is displayed
    When the user enters "new-password" in the "New password" field
     And the user enters "different-password" in the "Confirm new password" field
    Then the "Change Password" button is disabled
     And a settings error message "Passwords do not match" is displayed
