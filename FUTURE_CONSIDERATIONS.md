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

## Blank task titles

A task title can be cleared and left blank, and the blank task is saved like any
other. The TM-6 browser checks observed this; it matches the code, which has no
title validation.

Whether blank titles should be prevented is a product decision that has not been
made. If they are, decide what happens to a title while it is being edited, and
to blank titles already saved under `taskmanager.tasks`.

## Layout on narrow screens

Low priority. The app was not designed specifically for mobile.

In the TM-6 browser checks, at a viewport 390 px wide in desktop Chrome:

- the "Task Manager" heading overlapped the "Add Task" button;
- the due status text, such as "Completed" or "2 days remaining", ran past the
  right edge of the task card;
- longer task titles were cut off.

A screenshot of the deployed app in Chrome on the owner's iPhone shows a
substantially better layout:

- the heading wraps without overlapping the "Add Task" button;
- the due status text stays within the task cards;
- the assignee photos display correctly;
- the controls appear usable;
- some longer task titles are still cut off.

The difference may come from how a narrow desktop viewport differs from a real
mobile browser, and from the assignee photos, which were blocked in the browser
checks and shown as broken images.

So this is not a confirmed general mobile defect, and it was not a TM-6
acceptance failure. No change is needed now. If narrow-screen layout becomes a
goal, start from a real phone, where truncated long titles are the one issue
seen so far.
