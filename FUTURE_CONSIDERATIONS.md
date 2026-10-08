# Future considerations

These are observations that may be relevant to future work. They are not
requirements, commitments, or scheduled work.

## Task filtering

`getVisibleTasks` currently lives in `assigneeFilter.ts`, which is appropriate
while assignee is the only task filter.

If additional task filters are introduced (for example status, completion, or
priority), reconsider whether the combined filtering logic belongs in `tasks.ts`
or a dedicated task-filtering module.

Keep filter-selection persistence separate from the pure filtering logic, and
preserve full-list indexes required for filtered drag-and-drop.

## Voice input

TM-4 adds dictation into task-title inputs. Future voice functionality is likely
to include:

- dictation into other editable text controls, such as text areas, using the
  same insert-like-typing behaviour;
- spoken commands that perform actions or create or edit task data, rather than
  inserting recognised text.

Keep dictation behaviour independent of task titles and single-line inputs where
practical, and leave room to route recognised speech to either text insertion or
command handling.
