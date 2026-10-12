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

Dictation into a multi-line notes field is recorded as an idea in TM #25.

TM #60 added the first of these: describing one new task by voice or typing,
with guided English phrases and an explicit Create. Its recognised speech goes
to a description sink in `DictationController`, not to a text target. General
spoken commands, and voice editing of existing tasks, still have no
demonstrated user need. If they are taken up, consider:

- how to avoid ordinary dictated text being taken as a command, which TM #60
  answers only for its own composer;
- whether to act on provisional text, as TM #60 does for display only, or on
  final results;
- what happens when a command is ambiguous, and when to ask for confirmation.

Live transcripts may show that Speechmatics writes some guided phrases in ways
the interpreter does not match, such as "priority to" for "priority two". Tune
`interpretDescription.ts` from that evidence.

## Blank task titles

A task title can be cleared and left blank, and the blank task is saved like any
other. The TM-6 browser checks observed this; it matches the code, which has no
title validation.

"Describe a task" (TM #60) requires a title before it creates a task. That rule
is for that flow only: the title can still be cleared afterwards on the card.

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

A screenshot of the deployed app in Chrome on Robin's iPhone shows a
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
