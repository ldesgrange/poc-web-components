@task @counter
Feature: Active task counter
  As a user
  I want to see how many active tasks remain
  So that I can estimate my workload

  Background:
    Given a compatible web browser
    And an initialized and unlocked encryption key
    And a task list with:
      | task            | status    |
      | Buy milk        | active    |
      | Clean the house | completed |
      | Walk the dog    | active    |

  @task @counter @smoke
  Scenario: Display a live count of active tasks (plural)
    When I view the task list
    Then the active tasks counter should display "2 items left"

  Scenario: Display a live count for a single active task (singular)
    Given I mark the task "Walk the dog" as completed
    When I view the task list
    Then the active tasks counter should display "1 item left"

  Scenario: Display a live count when no active tasks remain (zero)
    Given I mark the task "Buy milk" as completed
    And I mark the task "Walk the dog" as completed
    When I view the task list
    Then the active tasks counter should display "0 items left"
