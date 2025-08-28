@task @editing
Feature: Editing tasks
  As a user
  I want to rename existing tasks
  So that I can correct errors or update task names

  Background:
    Given a compatible web browser
    And an initialized and unlocked encryption key
    And a task list with:
      | task            | status |
      | Buy milk        | active |
      | Clean the house | active |

  @task @editing @smoke
  Scenario: Renaming a task
    When I rename the task "Buy milk" to "Buy oat milk"
    Then the task "Buy oat milk" should be visible in the list
    And the task "Buy milk" should not be visible in the list

  Scenario: Prevent renaming a task to an empty name
    When I try to rename the task "Buy milk" to ""
    Then the task "Buy milk" should still be visible in the list
    And a task-related error message "Task name is required" is displayed

  Scenario: Prevent renaming to a name used by another active task
    When I try to rename the task "Buy milk" to "Clean the house"
    Then the task "Buy milk" should still be visible in the list
    And a task-related error message "Task already exists" is displayed

  Scenario: Allow renaming to a name used only by completed tasks
    Given I mark the task "Buy milk" as completed
    And I add a task "Groceries"
    When I rename the task "Groceries" to "Buy milk"
    Then one "Buy milk" task should be "active"
    And one "Buy milk" task should be "completed"

  Scenario: Duplicate detection ignores case and surrounding whitespace when renaming
    When I try to rename the task "Clean the house" to "  BUY MILK  "
    Then the task "Clean the house" should still be visible in the list
    And a task-related error message "Task already exists" is displayed
