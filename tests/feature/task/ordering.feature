@task @ordering
Feature: Ordering active tasks
  As a user
  I want to manually reorder my active tasks
  So that the list reflects my priorities

  Background:
    Given a compatible web browser
    And an initialized and unlocked encryption key
    And a task list with:
      | task | status    |
      | A    | active    |
      | B    | completed |
      | C    | active    |

  @task @ordering @smoke
  Scenario: Manually reordering active tasks
    Given I add a task "D"
    When I move the task "D" above the task "A"
    Then the active tasks should be ordered as:
      | task |
      | D    |
      | A    |
      | C    |

  Scenario: Reordering affects only active tasks
    When I move the task "C" above the task "A"
    Then the active tasks should be ordered as:
      | task |
      | C    |
      | A    |
    And the completed task "B" should remain completed
