@task @deleting
Feature: Deleting tasks
  As a user
  I want to delete tasks I no longer need
  So that my task list stays relevant

  Background:
    Given a compatible web browser
    And an initialized and unlocked encryption key
    And a task list with:
      | task     |
      | Buy milk |

  Scenario: Deleting a task requires confirmation (cancel)
    When I attempt to delete the task "Buy milk" but cancel the confirmation
    Then the task "Buy milk" should be visible in the list
    And the task list should contain "1" task

  @task @deleting @smoke
  Scenario: Deleting a task after confirming
    When I confirm deleting the task "Buy milk"
    Then the task list should contain "0" tasks
    And the task "Buy milk" should not be visible in the list
