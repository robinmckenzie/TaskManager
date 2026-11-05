# Prototype 3: Distinctive ("Docket")

The third TM #56 concept. The list reads like a ruled ledger, or docket. Each entry starts with a **countdown block**: a large day count with its state word ("Overdue 2 days", "Due Today", "Due in 3 days"). The title runs the full width of the entry, with priority and date on a quiet line beneath it. One task is always selected, and it is edited in a **dock fixed to the foot of the window**, which also holds the dictation status and the level meter choice. The look is warm paper and near-black ink, with a serif masthead, heavy numerals, square corners and a yellow "highlighter" for focus and selection.

**Status:** built, not yet seen in a browser. See [Verification](#verification).

**View it:** run `npm run dev` and open <http://localhost:5173/prototypes/distinctive/>. If port 5173 is busy, Vite picks the next free one (Robin's screenshots used 5174, so <http://localhost:5174/prototypes/distinctive/>). Use the port Vite prints. `/prototypes/` lists all three prototypes.

## What to try

- **Read the left edge.** Run your eye down the countdown blocks: solid red "Overdue 2 days", solid yellow "Due Today" and "Due in 1 day", tinted "Due in 3 days", outlined "Due in 10 days", dashed "No date", green tick "Done". Each block has its own words and shape as well as its colour.
- **Read the titles.** Every title has the width of the entry (about 720 px in a 1280 px window). The long onboarding title wraps instead of being cut off.
- **Select a task** by clicking anywhere on its entry, or by tabbing into it. The entry turns highlighter yellow with an ink bar on the left and an "Editing below" tag, and the dock names it: "Editing Fix authentication bug".
- **Edit in the dock.** Due date has one-click Today, Tomorrow and In a week, a date field, and No date. Priority is five buttons from low to high. Assignee is four photo chips. Delete is at the top right of the dock. The list does not move while you edit.
- **Jump straight to a field.** Click a countdown block or a date and the dock's date field takes focus. Click the priority squares and the priority takes focus. Click a person on an entry and the assignee takes focus.
- **Edit a title** by clicking it. It reads as text, shows an edge on hover and an ink border when focused. Enter does nothing, as in the app; pasted line breaks become spaces.
- **Tick the square box** at the right-hand end of an entry to complete it. The block turns green with a tick and "Done", and the title is muted.
- **Drag an entry** by the grip on its far left.
- **Filter by assignee** with the pills under the masthead. Add Task gives new tasks to the filtered person, as in the app.
- **Dictate:** click a microphone beside a title. The dock's lower line shows "Connecting", then "Listening" with the level meter, then "Finishing" and "Dictation stopped." when you click again. Moving focus out of the titles stops it, as in the app.
- **Level meter choice:** the "Level meter: Horizontal bar, solid" button at the bottom right of the dock opens a small panel above it, with a live preview. It can be changed while dictating without stopping dictation.
- **Keyboard:** Tab goes title, microphone, "Edit details" (the person on the entry), done box, then the next entry. "Edit details" moves focus into the dock's date field. Escape in the dock returns focus to that entry's "Edit details".
- **Reviewer bar** (dark strip at the top, not part of the design): switch dictation to "Not configured".

Not simulated, as in Refined and Modern: the Ctrl + Alt shortcut, inserting dictated text, persistence, sign-in (the button does nothing) and the account panel.

## Design process

### Primary user needs

Worked out from the app, the ticket and Robin's screenshots, in order of how often they arise:

1. **What needs doing now?** Is anything overdue, due today or due soon? This is the first question on opening the app.
2. **What is the task?** Read the title in full and change it, often by dictation.
3. **Tick it off.** Completion is the most frequent edit.
4. **Who has it, and how important is it?** Read at a glance, changed now and then.
5. **Reschedule.** Changing the date is the most common detail edit, and usually to a near date.
6. **Keep my order.** The list is in a manual order that the user arranges by dragging. That order is established behaviour, so the design must not re-sort or group.
7. **Less often:** add, delete, filter by person, choose a meter.

Modern answered needs 2 and 4 well. Its title column, summary columns and panel beneath the row work. Distinctive tries to answer need 1 better than Modern, and needs 2 and 5 at least as well, with a different structure.

### Concepts considered

**A. People lanes.** A board with one column per assignee. Reassign by dragging between columns; urgency shown on each card.

```
+-- Aaron -------+-- Alice --------+-- Bob ----------+-- Charlie ------+
| [3d] Write     | [Today] Prepare | [-2] Fix auth   | [1d] Review     |
|  release notes |  sprint demo    |  bug            |  dictation PR   |
|                | [ - ] Plan the  | [✓] Deploy      | [10d] Update    |
|                |  next quarter.. |  initial build  |  the onboarding |
+----------------+-----------------+-----------------+-----------------+
```

**B. Deadline horizon.** Tasks placed on a horizontal timeline of the next fortnight, with overdue on the left and undated tasks in a tray.

```
 OVERDUE | Thu 5 | Fri 6 | Sat 7 | Sun 8 | ... | Sun 15 | LATER | NO DATE
 [Fix    ] [Prep  ] [Revw ]        [Write]        [Update ]         [Plan ]
 [auth ✗ ]
```

**C. Docket.** A ruled list in the user's own order. Each entry is led by a countdown block, the title takes the full width, and one fixed dock edits whichever entry is selected.

```
+--------------------------------------------------------------------------------+
| Reviewer bar (not part of the design)                                          |
+--------------------------------------------------------------------------------+
|  Task Manager  7 tasks                          [Sign in with Google] [+ Add Task]
|  ==============================================================================|
|  ASSIGNEE (All assignees) (Aaron) (Alice) (Bob) (Charlie)        dictation hint |
|  ==============================================================================|
|  : [OVERDUE ] Fix authentication bug                         (o)  (B) Bob   [ ] |
|    [   2    ] ■■■■■ Priority 5   Due Tue 3 Nov                                  |
|    [  days  ]                                                                   |
|  : [  DUE   ] Prepare sprint demo                            (o)  (A) Alice [ ] |
|    [ Today  ] ■■■■□ Priority 4   Due Thu 5 Nov                                  |
|  ...                                                                            |
|  : [DUE IN  ] Update the onboarding documentation for contributors  (o) (C) ... |
|    [  10    ] joining the project next month                                    |
|    [  days  ] ■■■□□ Priority 3   Due Sun 15 Nov                                 |
|                                                          Reset to sample tasks |
+=================================================================================+
| EDITING  Fix authentication bug                                       [Delete] |
| DUE                                          PRIORITY               ASSIGNEE    |
| [Today][Tomorrow][In a week][03/11/2026][No date]  low [1][2][3][4][5] high  (Aaron)(Alice)(Bob)(Charlie)
| ------------------------------------------------------------------------------ |
| (mic) Listening [meter]       (i) This demo may retain...   [Level meter: ... ^] |
+--------------------------------------------------------------------------------+
```

### Critique

- **A, People lanes.** Striking, and it answers "who is doing what" perfectly. But it fails need 1: to find what is overdue you scan four columns. It fails need 6, because there is no longer one order, and a drag means two things (reorder, or reassign). It does not scale past five or six people, and at 1024 px each lane is about 240 px, so titles wrap into narrow towers. Rejected.
- **B, Deadline horizon.** Answers need 1 superbly, but it replaces the manual order with a date order, which is established behaviour. Undated tasks are second-class, and long titles do not fit in a day column. It would be a good second view, not the main one. Rejected.
- **C, Docket.** It keeps the manual order and one list. It puts urgency in the first place the eye lands, as a big figure rather than one chip among several. It gives the title more width than any other concept. The dock lets editing be richer (quick dates, all people visible) without pushing the list around.
- **Generic AI patterns checked against C:** no gradients, no glass, no rounded floating cards with soft shadows, no purple, no emoji, no hero band. The identity comes from materials (paper, ink, a highlighter), typography (serif masthead, heavy tabular figures, small caps) and ruled lines. Colour is kept for state.
- **Wasted space in C.** The dock costs about 160 px of height at all times. That is the main price. To make it earn its place, it is never empty while a task is on show (the first task is selected by default), and it also absorbs the dictation status, retention notice and meter choice, which otherwise need a band of their own. With no sidebar, the list has the full width.
- **Unnecessary complexity in C.** An early version had a fortnight strip of day cells above the list as an overview of workload. It repeated what the countdown blocks already show, for seven tasks, so it was dropped. A "Settings" dialog was also dropped: the meter choice now sits beside the status it affects, and there is nothing else to set.

### Why Docket

It competes with Modern on Modern's strengths and differs in kind, not just in look:

- **Urgency first, as typography.** Modern puts due state in a column to the right of the title. Docket leads with it as the largest figure on the entry, so "what is late?" is answered by reading down the left edge.
- **Titles get the full width.** Modern's columns leave the title about 460 px at 1280 px. Docket moves the details under the title and gives it about 720 px, so the long title wraps once instead of twice, and most never wrap.
- **Editing does not move the list.** Modern's panel opens inside the list and pushes the rows below it down. Docket's dock is always in the same place, so the hand and eye learn it, and you can go down the list changing one thing on each task (click entry, click priority, click next entry, click priority) without anything shifting.
- **No sidebar.** The filter, hint and actions fit in the header, so the list keeps the whole width at 1024 px.
- **A clear character.** Refined is the familiar app, polished. Modern is calm and neutral. Docket is the one with a recognisable personality, without decoration that gets in the way.

## Visual and interaction decisions

### Palette

| Token | Value | Use | Contrast |
| --- | --- | --- | --- |
| `--dk-page` | `#f4f0e6` | Warm paper page | - |
| `--dk-sheet` | `#fffdf7` | The list, dock and controls | - |
| `--dk-ink` | `#1f1b16` | Text, primary button, chosen options | 16.8:1 on sheet |
| `--dk-ink-2` | `#5a5247` | Secondary text | 7.6:1 on sheet, 6.8:1 on page, 6.9:1 on selected |
| `--dk-edge` | `#857a6b` | Control edges | 4.1:1 on sheet, 3.7:1 on page (3:1 needed) |
| `--dk-rule` | `#e4dccb` | Decorative ruled lines only | - |
| `--dk-highlight` | `#ffd84d` | Focus halo | ink on it 12.4:1 |
| `--dk-selected` | `#fff3c4` | Selected entry | ink 15.4:1 |
| `--dk-late` | `#b42318` | Overdue block, overdue date, Delete, recording | white on it 6.6:1; as text 6.5:1 |
| `--dk-soon` | `#f5b800` | Due soon block | ink on it 9.6:1 |
| `--dk-week` / tint | `#7a4f00` / `#fdefc8` | This week block | 6.2:1 on tint |
| `--dk-done` / tint | `#1d6b41` / `#e3f1e7` | Completed block, ticked box | 5.6:1 on tint, 6.4:1 on sheet |

The ratios are worked out from the values (WCAG formula), not measured on screen.

### Typography

- System fonts only. Sans (`system-ui` stack) for everything you read and edit. A system serif (`ui-serif`, then Iowan Old Style, Palatino Linotype, Georgia, Cambria) for the masthead, the task count, the dock's "Editing" title and empty states only. Every one is installed with Windows or macOS; no web font is loaded.
- Countdown figures are 26 px, weight 800, with `tabular-nums lining-nums`, so numbers line up down the edge and Georgia's old-style figures are never used.
- Titles are 17 px semibold, the largest sans text on the page. The meta line is 13 px.
- Labels use `font-variant-caps: all-small-caps` ("Assignee", "Due", "Priority", "Editing"), a quieter alternative to Modern's spaced capitals.

### Spacing and shape

- Square-ish corners (3 px) everywhere except pills and avatars, as with paper and rubber stamps.
- The list is a single ruled sheet: a 2 px ink rule on top, hairlines between entries. The masthead and dock use a 3 px double ink rule, like a ledger's.
- Entries are about 82 px tall, set by the 62 px countdown block. That is taller than Modern's 44 px rows and shorter than the app's 100 px cards. Seven tasks take about 580 px.

### Due state

Each state has a different label, figure and shape, so colour is never the only signal:

| State | Block | Words |
| --- | --- | --- |
| Overdue | Solid red, white text | OVERDUE / 2 / days |
| Due soon | Solid yellow, ink text | DUE / Today, or DUE IN / 1 / day |
| This week | Yellow tint, brown text and edge | DUE IN / 3 / days |
| Later | Plain outline | DUE IN / 10 / days |
| No date | Dashed outline | NO DATE / – |
| Completed | Green tint and edge, tick | DONE / ✓ |

The overdue date in the meta line is also red and bold. The app's own wording ("2 days overdue", "Due today", "1 day remaining") is kept as hidden text in each entry's description, so screen readers hear the app's words. The block is hidden from them.

### Interaction

- **Selection** is the core of the model. Exactly one entry is selected whenever any task is on show: the one last clicked or focused, or else the first. Focus moving into an entry selects it, so keyboard users never select by a separate step.
- **The dock** edits the selected task only. It names the task so there is no doubt. Its controls are native: buttons with `aria-pressed` for the quick dates, a date input, and radio groups for priority and assignee, so the arrow keys work.
- **Pointer shortcuts:** clicking the countdown block, the date, the priority squares or the person on an entry selects the task and focuses that field in the dock. These parts are not separate tab stops. Keyboard users use the one "Edit details" button.
- **Always visible:** the grip, microphone and done box are shown on every entry, unlike Modern's hover reveal. They are drawn quietly (thin edges, muted ink) so that they do not compete with the title.
- **Focus:** one style everywhere, a 2 px ink outline with a 5 px highlighter halo. It is visible on paper, on the yellow selection, and on ink buttons.
- **Motion:** only 0.1 s colour transitions and the meter caret. Reduced motion turns them all off.

## Files and architecture

```
prototypes/distinctive/
  index.html          Entry page; loads /src/prototypes/distinctive/main.tsx
  README.md           This write-up and handover
src/prototypes/distinctive/
  main.tsx            Mounts DistinctiveApp with distinctive.css; no app CSS, no analytics
  DistinctiveApp.tsx  The whole Docket page, in one file
  distinctive.css     All Distinctive styling: tokens, layout, components, level meter rules
  docket.ts           Pure helpers: countdown wording, short due date, quick due dates
  docket.test.ts      Unit tests for docket.ts against the shared sample tasks
```

- Shared with Refined and Modern: only `src/prototypes/sampleTasks.ts` (the seven tasks, users and `getTaskState`) and `src/prototypes/simulatedDictation.ts`. No component, class or token from either is used. Class names start with `dk-` and tokens with `--dk-`.
- From the app, the same pure imports as the others: `describeDueStatus`, `getDaysUntilDue`, `getTaskControlNames`, `sortAssigneesByName`, `reorderTasks`, `describeDictationPhase`, `LevelMeter` and `MicrophoneIcon`. None of the forbidden imports listed in `prototypes/README.md`.
- `DistinctiveApp.tsx` runs top to bottom: icons; small pieces (`Avatar`, `PriorityPips`, `CountdownBlock`); dictation (`DictationButton`); the meter choice (`ToggleRow`, `MeterChooser`, `DictationLine`); the `Dock`; one list `Entry`; the `Header`; the `ReviewerBar`; and `DistinctiveApp`, which holds all state.
- State in `DistinctiveApp`: tasks, assignee filter, selected task id, a dock focus request, simulated dictation, meter choice, the dragged task and dictation availability. The selected task is derived: the chosen id if it is on show, or else the first visible task. Nothing is persisted.
- Layout: the page is a fixed-height flex column: reviewer bar, a scrolling area (`.dk-scroll`) holding the header and list, and the dock (`flex: none`). The dock is not `position: fixed` or `sticky`, so it never covers the last entry. Each entry is a five-column grid: grip 16 px, countdown 72 px, body, person 148 px, done box 36 px.

### Widths, worked out before building

The content area is at most 1120 px.

| Window | Content | Entry body | Title text area | Dock fields |
| --- | --- | --- | --- | --- |
| 1280 px | 1120 px | about 762 px | about 722 px | due 438 + priority 254 + people with names 344 + gaps 56 = 1092 px, fits |
| 1024 px | 984 px | about 620 px | about 580 px | people as photos only below 1240 px: 438 + 254 + 154 + 56 = 902 px, fits |

These are calculations from the CSS, not measurements. If the dock's fields do not fit, they wrap onto a second line rather than overflow.

## Proposed behaviour changes

None of these is adopted. Each needs Robin's decision before it could reach the app. The bigger ones come first.

1. **One fixed editing dock instead of controls on each card.** Due date, priority and assignee are edited in a dock at the foot of the window, for the selected task. Changing a detail on a task that is not selected takes two clicks (select, change); on the selected one it takes one. The list never shifts. Is that better or worse than Modern's panel beneath the row?
2. **A selected task.** New concept: one task is always selected and highlighted, and the dock names it. Clicking an entry or focusing anything in it selects it.
3. **Delete moves into the dock** (two clicks: select, Delete). Still no confirmation, as now.
4. **One-click due dates** in the dock: Today, Tomorrow, In a week, and No date, beside the date field. New shortcuts, but they set the same `dueDate` field.
5. **Priority slider replaced** by five buttons, low to high, in the dock (a radio group). Entries show five squares and "Priority n".
6. **Assignee select replaced by photo chips** in the dock (a radio group), with names above 1240 px and photos only below. Like Modern's, this does not scale beyond about six people.
7. **Due state shown as a countdown block** at the start of each entry, with new short wording on screen: "Overdue 2 days", "Due Today", "Due in 1 day", "No date", "Done". The app's wording is kept for screen readers only. The entry's date is shown as "Due Tue 3 Nov". No card tint, so the documented pink background for overdue tasks goes.
8. **Completion is a square box at the right-hand end** of each entry, without the word "Complete" (its accessible name is still "Complete *task*"). Completed tasks are muted, not struck through.
9. **Long titles wrap.** The title becomes a text area that behaves as one line, as in Modern: Enter does nothing and pasted line breaks become spaces.
10. **Assignee filter becomes a row of pills** under the masthead, with photos. The task count stays the total, as in the app.
11. **Dictation status, retention notice and meter choice move into the dock's lower line.** The status line says "Dictation is off." when there is nothing else to say (on screen only; screen readers hear nothing new). The dictation hint stays in the header.
12. **Level meter choice in a small panel** opened from a button beside the dictation status, instead of the controls row (the app) or a Settings dialog (Refined, Modern). There is no Settings button in Distinctive.
13. **Keyboard:** "Edit details" on each entry moves focus to the dock. Escape in the dock returns focus to that entry. After Delete, focus and selection move to the next entry, or the previous one, or Add Task if none are left.
14. **Look:** warm paper and ink instead of white and blue, a serif masthead, and a yellow highlighter focus style instead of a blue ring.

## Advantages

- Urgency is the first thing read on every entry, and the most urgent states are the heaviest marks on the page.
- Titles have the most width of any concept, and do not compete with controls beside them.
- Editing never moves the list. The dock is in one place, so repeated edits are fast.
- Richer editing in less list space: quick dates and every person are one click away.
- Dictation status and its setting live together, in a fixed place, close to the bottom of the list where new tasks are added.
- Fewer tab stops than the app: four per entry (title, microphone, Edit details, done box), the same as Modern.
- A recognisable identity with no web font, no images beyond the photos and no new dependency.

## Trade-offs

- The dock takes about 160 px of height all the time, which matters on short windows.
- Selection is a new idea to learn, and the edited task is some distance from the dock. The highlight, the "Editing below" tag and the dock's heading are there to bridge that, but it needs trying.
- Entries are taller than Modern's rows, so fewer tasks fit on screen (about 7 against Modern's 13 in the same height).
- The countdown block's short wording ("Due in 10 days") differs from the app's ("10 days remaining").
- Paper and serif are a matter of taste. The character could tire faster than a neutral look.
- Photo chips do not scale to many people.

## Implementation complexity

Medium.

- **Markup in `App.tsx`:** the `Task` component becomes an entry (grip, countdown, title text area, meta line, person button, done box). A new `Dock` component and selection state are added at the app level. The header gains the filter pills.
- **Behaviour:** selection and its fallback, focus requests into the dock, Escape and focus after delete. All of it is in this prototype in about 150 lines.
- **Drag and drop:** react-dnd's drag source moves to the grip alone.
- **Dictation:** the title becomes a text area, so `useDictation`'s text insertion needs checking with one, as for Modern. The status component moves into the dock, and the meter selector into a disclosure panel, both keeping `data-dictation-setting`.
- **CSS:** a new stylesheet in place of most of `index.css`.
- **Tests:** the countdown wording and quick dates are pure and already tested here (`docket.test.ts`). Browser checks would be needed for selection, the dock, focus and drag and drop. No change to saved data.

## Would a component library help?

No. Everything is native: radio groups give arrow keys, toggle buttons use `aria-pressed`, the meter panel is a disclosure button with `aria-expanded`. The dock is static layout, not a popover, so there is no positioning to get wrong. The only floating piece is the meter panel, which is anchored by plain CSS and closed by an outside pointer press or Escape. A headless library would help only if the panel grew into a proper menu.

## Technical discoveries and pitfalls

- **`react-hooks/refs` and ref maps.** A helper that returned a register callback for a given map, called as `register(titleInputs.current)` in the JSX, was rejected by `react-hooks/refs` ("Cannot access ref value during render"), because `.current` is read during render. Two plain functions that read `.current` only inside the callback pass. Modern's pattern was the safe one.
- **Selection derived, not stored.** Storing the selected id and deriving the selected task (the id if visible, else the first visible task) avoids effects that "fix up" selection after filtering, deleting or resetting. A filter that hides the selected task simply moves the selection to the first visible one, and switching back restores it.
- **Focus requests across components.** To focus a dock field after a click on an entry, the app keeps `{ field, count }` in state. The dock focuses `[data-focus=field]` in an effect on that object. The count makes a repeat request on the same field a new object, so it fires again. Radios carry `data-focus` only on the checked one, so the request lands on the current value after the render that selected the task.
- **A pointer click versus a keyboard click.** As in Modern, `event.detail === 0` marks a keyboard activation. "Edit details" from the keyboard goes to the first dock field (due date); a pointer click on the person goes to the assignee.
- **Focus moving into an entry selects it.** React's `onFocus` bubbles, so one handler on the `<li>` catches focus on the title, microphone, button or box.
- **A dock in the flow, not fixed.** With `position: fixed` the dock would cover the last entry and the reset link, and need padding to compensate. As the last item of a 100vh flex column, it simply ends the scroll area.
- **The meter panel opens upwards.** It is absolutely positioned at `bottom: calc(100% + 8px)` from its button. Opening downwards would go off the window, since the dock is at the bottom. Its toggle buttons prevent `mousedown`, like the app's selector, so focus stays in the title being dictated into, and the whole chooser carries `data-dictation-setting` for keyboard users who tab into it.
- **Empty status text.** "Dictation is off." is drawn by CSS on the empty status paragraph with `content: "..." / ""`. The empty alternative text keeps it out of the live region, so screen readers announce only the app's own messages. This syntax needs Firefox 128 or later; older Firefox ignores the whole rule and shows nothing, which is harmless.
- **Old-style figures.** Georgia and some other system serifs have old-style numerals, which bob up and down. The countdown figures use the sans stack with `lining-nums tabular-nums`, and the serif is kept away from numbers except the count in the masthead.
- **Same sandbox limits as before:** no browser (below), no `ss` or `netstat` (check port 5183 with curl), and the unrelated Speechmatics adapter test failure.

## Failed approaches and lessons learned

- **Considered and rejected:** people lanes and the deadline horizon (see [Critique](#critique)).
- **Dropped during design:** a fortnight strip of day cells above the list, as a workload overview and a way to reschedule by clicking a day. It repeated the countdown blocks and added a second way to set dates. The dock's three quick dates do the useful part.
- **Dropped during design:** a Settings dialog for the meter choice, as in Refined and Modern. With the dictation status in the dock, the setting fits beside it, and a dialog for one setting was more machinery than it needed.
- **Dropped during design:** putting the dictation hint in the dock as well. At 1024 px the hint, status, notice and meter button do not fit on one line, so the hint stays in the header.
- **Lint failure, fixed:** the `register(map)` helper described above.
- **Lesson, as for Modern:** without a browser, widths have to be worked out on paper. They are in [Widths, worked out before building](#widths-worked-out-before-building), and need confirming on screen.

## Verification

Done in the cloud sandbox:

- `npm run build` and `npm run lint` pass, and `tsc` type-checks all prototype code.
- `npm test`: 559 of 560 pass, including the 6 new tests in `docket.test.ts`. The one failure is `src/dictation/speechmaticsAdapters.node.test.ts`, "stops a connection that is closed while still connecting", which also failed on unchanged `main` code in this sandbox for Refined and Modern (see `prototypes/README.md`).
- **Production build unchanged:** every file in `dist/` built from this branch is byte-for-byte identical (SHA-256) to `dist/` built from `origin/main`, and contains no prototype code. `dist/` holds only `index.html`, `privacy.html`, `favicon.svg`, `icons.svg` and `assets/`.
- No file outside `prototypes/` and `src/prototypes/` differs from Modern's branch. The Distinctive code reads and writes no storage and makes no requests other than the assignee photos.
- `npm run dev:browser-check` served `/prototypes/`, `/prototypes/distinctive/`, `/prototypes/modern/`, `/prototypes/refined/` and every Distinctive module with HTTP 200, and both status endpoints reported `configured: false`. The server was then stopped and port 5183 confirmed free.
- Contrast was calculated from the token values: every text pair passes 4.5:1 (lowest: green text on the completed tint, 5.6:1), and control edges and the focus outline pass 3:1 (lowest: control edges on the page, 3.7:1). These are calculations, not measurements of the rendered page.

Not done, because no browser was permitted: the Playwright MCP server failed to connect, as for Refined and Modern. The sandbox sets `PLAYWRIGHT_BROWSERS_PATH` and `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD`, and `server/startPlaywrightMcp.mjs` refuses to run when any `PLAYWRIGHT_*` variable is set. `AGENTS.md` forbids working around that or using another browser. So none of the following has been seen:

- How the page looks at 1280 px and 1024 px: the header, the countdown blocks, the dock's fields fitting on one line, and the dock's height.
- Long-title wrapping and the text area's height, including after a resize.
- Every interaction under [What to try](#what-to-try): selection, the dock and its focus handling, pointer shortcuts into the dock, the meter panel, drag and drop, Escape, and focus after delete.
- Reduced motion, how the date input renders, the serif chosen on Robin's system, and the photo fallback to initials.

These need a check in a local Claude Code session, where the Playwright MCP server can start, or Robin looking at the page.
