@compatibility
Feature: Browser compatibility checks
  As a user who wants to use the application
  I want to know that the application can work on my device
  So that I can use the application

  Acceptance criteria:
  - I can see if the application is running in a Secure Context
  - I can see if crypto primitives are available
  - I can see if the Storage API is available
  - I can see if Persistent Storage is available
  - I can see if IndexedDB is available
  - I can grant the `persistent-storage` user permission to the application

  @compatibility @smoke
  Scenario: user arrives on the application using a browser not running in a Secure Context
    Given the user’s browser "doesn’t" run in a Secure Context
     When the user loads the application
     Then the application informs the user that it is "not running" in a Secure Context
      And the application informs the user to run the application over HTTPS
  @compatibility
  Scenario: user arrives on the application using a browser with Storage API
    Given the user’s browser "does" run in a Secure Context
     When the user loads the application
     Then the application informs the user that it is "running" in a Secure Context

  @compatibility
  Scenario: user arrives on the application using a browser without the required crypto primitives
    Given the user’s browser "doesn’t" have crypto required primitives
    When the user loads the application
    Then the application informs the user that the required crypto primitives are "not available"
  @compatibility
  Scenario: user arrives on the application using a browser with the required crypto primitives
    Given the user’s browser "does" have crypto required primitives
    When the user loads the application
    Then the application informs the user that the required crypto primitives are "available"

  @compatibility
  Scenario: user arrives on the application using a browser without Storage API
    Given the user’s browser "doesn’t" have Storage API
     When the user loads the application
     Then the application informs the user that the Storage API is "not available"
      And the application informs the user to use a web browser supporting "Storage API"
  @compatibility
  Scenario: user arrives on the application using a browser with Storage API
    Given the user’s browser "does" have Storage API
     When the user loads the application
     Then the application informs the user that the Storage API is "available"

  @compatibility
  Scenario: user arrives on the application using a browser without Persistent Storage
    Given the user’s browser "doesn’t" have Persistent Storage
     When the user loads the application
     Then the application informs the user that Persistent Storage is "not available"
      And the application informs the user to use a web browser supporting "Persistent Storage"
  @compatibility
  Scenario: user arrives on the application using a browser with Persistent Storage
    Given the user’s browser "does" have Persistent Storage
     When the user loads the application
     Then the application informs the user that Persistent Storage is "available"

  @compatibility
  Scenario: user arrives on the application using a browser without IndexedDB
    Given the user’s browser "doesn’t" have IndexedDB
    When the user loads the application
    Then the application informs the user that IndexedDB is "not available"
    And the application informs the user to use a web browser supporting "IndexedDB"
  @compatibility
  Scenario: user arrives on the application using a browser with IndexedDB
    Given the user’s browser "does" have IndexedDB
    When the user loads the application
    Then the application informs the user that IndexedDB is "available"

  @compatibility
  Scenario: persistent storage permission already granted
    Given the application is "allowed" to use persistent storage
     When the user loads the application
     Then the application informs the user that persistent storage permission is "granted"
      And the application "does not show" a permission request button
  @compatibility @smoke
  Scenario: user grants persistent storage permission when requested
    Given the application is "not allowed" to use persistent storage
     When the user loads the application
     Then the application "shows" a permission request button
      And the application explains why persistent storage permission is required
     When the user "grants" persistent storage
     Then the application informs the user that persistent storage permission is "granted"
  @compatibility
  Scenario: user denies persistent storage permission when requested
    Given the application is "not allowed" to use persistent storage
     When the user loads the application
     Then the application "shows" a permission request button
      And the application explains why persistent storage permission is required
     When the user "denies" persistent storage
     Then the application informs the user that persistent storage permission is "not granted"
      And the application informs the user to grant persistent storage permission
