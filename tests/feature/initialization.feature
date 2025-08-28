@initialization
Feature: Account initialization
  As a user who wants to use the application
  I need to set-up the encryption system
  So that my data can be safely stored

  Acceptance criteria:
  - The application asks to set-up a password

  @initialization @smoke
  Scenario: user arrives on the application without an encryption key configured
    Given a securely generated encryption key "is not stored" in IndexedDB
     When the user loads the application
     Then the application asks the user to set-up a password
      And the submit button is disabled
     When the user provides a password and its confirmation
     Then the application generates an encryption key and stores it password-encrypted in IndexedDB

  @initialization
  Scenario: user provides mismatching passwords
    Given a securely generated encryption key "is not stored" in IndexedDB
     When the user loads the application
     Then the application asks the user to set-up a password
      And the submit button is disabled
     When the user provides mismatching password and confirmation
     Then an error message "Passwords do not match" is displayed
      And the submit button is disabled
