# TM-1 — Filter tasks by assignee

## User problem

As the task list grows, users need a way to focus on tasks assigned to a particular person.

## Requirements

- Add an assignee filter at the top of the task column.
- The filter should be a dropdown containing "All assignees" plus each available user.
- Selecting an assignee displays only tasks assigned to that user.
- Selecting "All assignees" displays all tasks.
- The selected filter should remain selected after a page refresh.
- A first-time user should default to "All assignees".
- If the previously selected assignee is no longer available, fall back to "All assignees".
- Filtering should not otherwise change task behaviour: both completed and incomplete tasks for the selected assignee remain visible.

## Acceptance criteria

- The assignee dropdown appears at the top of the task column.
- It contains "All assignees" and every available user.
- "All assignees" shows the complete task list.
- Selecting a user shows only that user's tasks.
- Both completed and incomplete matching tasks are shown.
- The selection survives a page refresh.
- With no saved selection, "All assignees" is selected.
- An invalid previously selected assignee falls back to "All assignees".
- Existing task persistence and task behaviour continue to work.
