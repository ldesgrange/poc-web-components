@unlock
Feature: Master key unlock
  As a user who wants to use the application
  I need to unlock the master key
  So that my data can be encrypted/decrypted

  Acceptance criteria:
  - The application asks for the application password

  @unlock @smoke
  Scenario: user arrives on the application with with a locked key
    Given a securely generated encryption key "is stored" in IndexedDB
      And the key has not been unlocked
     When the user loads the application
     Then the application asks the user to unlock it
     When the user provides "a valid" password
     Then the key is "unlocked"

  @unlock
  Scenario: user provides invalid password to unlock the key
    Given a securely generated encryption key "is stored" in IndexedDB
      And the key has not been unlocked
     When the user loads the application
     Then the application asks the user to unlock it
     When the user provides "an invalid" password
     Then the key is "not unlocked"
      And a key-related error message "Invalid password" is displayed
