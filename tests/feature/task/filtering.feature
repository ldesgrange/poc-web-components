@task @filtering
Feature: Filtering and default visibility
  As a user
  I want to filter tasks by status
  So that I can focus on what matters now

  Background:
    Given a compatible web browser
    And an initialized and unlocked encryption key
    And a task list with:
      | task            | status    |
      | Buy milk        | active    |
      | Clean the house | completed |

  @task @filtering @smoke
  Scenario: Default view shows only active tasks
    When I view the task list
    Then the task "Buy milk" should be visible in the list
    And the task "Clean the house" should not be visible in the list

  Scenario: Filtering by completed tasks
    When I filter by "completed" tasks
    Then the task "Buy milk" should not be visible in the list
    And the task "Clean the house" should be visible in the list

  Scenario: Filtering by all tasks
    When I filter by "all" tasks
    Then the task "Buy milk" should be visible in the list
    And the task "Clean the house" should be visible in the list
