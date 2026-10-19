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

Spoken commands have no demonstrated user need yet. If they are taken up, a
Codex investigation of 8 October 2026 suggested considering:

- an explicitly activated command mode, starting with one small action such as
  creating a task;
- how to avoid ordinary dictated text being taken as a command;
- acting on final results only, not on provisional text;
- what happens when a command is ambiguous, and when to ask for confirmation.

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

## Sign-in

TM #45 added Google sign-in with Better Auth. If its code is reused elsewhere:

- Rate limits on sign-in are counted in memory by each function instance, so
  they are approximate and reset when an instance stops. A shared store, such
  as a database table, would make them exact.
- Signing in reloads the page. Where browser storage is blocked, anything held
  only in memory is lost without a warning, which was accepted for this demo.
  A real product might warn first, or sign in through a popup.
- Vercel previews have no sign-in, which was dropped from TM #45 because the
  app is a personal demo. Better Auth's OAuth proxy, which signs a preview in
  through production with its own store, was built and then removed in that
  pull request. The sign-in guide in Robin's project starters describes it.
