# TM-1 — Filter tasks by assignee

## User problem

As the task list grows, users need a way to focus on tasks assigned to a particular person.

## Requirements

- Add an assignee filter at the top of the task column.
- The filter should be a dropdown containing "All assignees" plus each available user.
- "All assignees" should appear first, followed by users alphabetically by name.
- Each task's assignee dropdown should display users in the same alphabetical order by name as the filter dropdown.
- Ordering filter options must preserve the underlying user order used for the default assignee under "All assignees".
- Selecting an assignee displays only tasks assigned to that user.
- Selecting "All assignees" displays all tasks.
- The selected filter should remain selected after a page refresh.
- A first-time user should default to "All assignees".
- If the previously selected assignee is no longer available, fall back to "All assignees".
- When filtered to a specific assignee, new tasks default to that assignee and remain visible in the filtered view.
- When "All assignees" is selected, new tasks retain the existing default assignee behaviour.
- Filtering should not otherwise change task behaviour: both completed and incomplete tasks for the selected assignee remain visible.

## Acceptance criteria

- The assignee dropdown appears at the top of the task column.
- It contains "All assignees" and every available user.
- "All assignees" is the first option, and user options are alphabetical by name even when the underlying user list is not.
- Displaying alphabetical filter options does not change the underlying user order or default assignee behaviour under "All assignees".
- Each task's assignee dropdown contains every available user in the same alphabetical order as the filter's user options, without changing the underlying user order.
- "All assignees" shows the complete task list.
- Selecting a user shows only that user's tasks.
- Both completed and incomplete matching tasks are shown.
- The selection survives a page refresh.
- With no saved selection, "All assignees" is selected.
- An invalid previously selected assignee falls back to "All assignees".
- Adding a task while filtered assigns it to the selected assignee and displays it immediately.
- Adding a task under "All assignees" retains the existing default assignee behaviour.
- Existing task persistence and task behaviour continue to work.
