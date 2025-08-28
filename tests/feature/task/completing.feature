@task @completing
Feature: Completing tasks
  As a user
  I want to mark tasks as completed or active
  So that I can see what I have already done

  Background:
    Given a compatible web browser
    And an initialized and unlocked encryption key
    And a task list with:
      | task            | status |
      | Buy milk        | active |
      | Clean the house | active |

  @task @completing @smoke
  Scenario: Marking a task as completed
    When I mark the task "Buy milk" as completed
    Then the task "Buy milk" should be marked as completed
    And the task "Clean the house" should still be active

  Scenario: Marking a completed task back to active
    Given the task "Buy milk" is marked as completed
    When I mark the task "Buy milk" as active
    Then the task "Buy milk" should be marked as active

  Scenario: Prevent reactivating a completed task when an active duplicate exists
    Given the task "Buy milk" is marked as completed
    And I add a task "Buy milk"
    When I mark the completed task "Buy milk" as active
    Then the task list should contain "3" tasks
    And one "Buy milk" task should be "active"
    And one "Buy milk" task should be "completed"
    And a task-related error message "Task already exists" is displayed
