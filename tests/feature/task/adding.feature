@task @adding
Feature: Adding tasks
  As a user
  I want to add new tasks to my task list
  So that I can keep track of my upcoming work

  Background:
    Given a compatible web browser
    And an initialized and unlocked encryption key

  @task @adding @smoke
  Scenario: Adding a new task to the list
    Given an empty task list
    When I add a task "Buy milk"
    Then the task list should contain "1" task
    And the task "Buy milk" should be visible in the list

  Scenario: Adding multiple tasks
    Given an empty task list
    When I add a task "Buy milk"
    And I add a task "Clean the house"
    Then the task list should contain "2" tasks
    And the task "Buy milk" should be visible in the list
    And the task "Clean the house" should be visible in the list

  Scenario: Prevent adding an empty task
    Given an empty task list
    When I try to add an empty task
    Then the task list should contain "0" tasks
    And a task-related error message "Task name is required" is displayed

  Scenario: Prevent adding a duplicate task when an active one exists
    Given a task list with:
      | task     | status |
      | Buy milk | active |
    When I add a task "Buy milk"
    Then the task list should contain "1" task
    And a task-related error message "Task already exists" is displayed

  Scenario: Allow adding a duplicate task when only completed ones exist
    Given a task list with:
      | task     | status    |
      | Buy milk | completed |
    When I add a task "Buy milk"
    Then the task list should contain "2" tasks
    And one "Buy milk" task should be "active"
    And one "Buy milk" task should be "completed"

  Scenario: Duplicate detection ignores case and surrounding whitespace when adding
    Given a task list with:
      | task     | status |
      | Buy milk | active |
    When I add a task "  BUY MILK  "
    Then the task list should contain "1" task
    And a task-related error message "Task already exists" is displayed
