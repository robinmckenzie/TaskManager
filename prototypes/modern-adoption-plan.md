# Adopting Modern in production: implementation plan (TM #56)

Status: plan only. Nothing here is implemented, agreed as a requirement, merged or deployed.

Written 2026-11-05 on branch `claude/gallant-heisenberg-tlb4xc`, made from the Distinctive prototype branch `claude/intelligent-shannon-nlseaw` (commit b4230aa). All three prototypes and their write-ups are unchanged. `main` was at 9cdf0b5 when this was written, the same commit the prototypes were built on, so every statement about production code below describes `main` at that commit.

## 1. Direction approved by Robin

- **Modern is the visual and structural foundation**: compact task rows, the sidebar, its information hierarchy (title first, then due state, priority and assignee in aligned columns) and the expandable details panel beneath a row.
- **From Distinctive ("Docket"), adopt only the quick due-date actions**: Today, Tomorrow and In a week, offered in Modern's details panel beside the date field.
- **Do not import** Docket's fixed editing dock, its "selected task" model, its countdown blocks or its visual style (paper, serif masthead, yellow highlighter).
- **Preserve existing production functionality** unless a change is explicitly approved. Every prototype behaviour that differs from production is listed in section 5 as a decision, not assumed.

## 2. Before any code is written

TM #56 says implementing the chosen design is a separate ticket. So:

1. Create an implementation ticket (a STUB or DRAFT, written as User story, Requirements, Acceptance criteria), referencing TM #56 and this plan.
2. Robin answers the decisions in section 5. The answers go into the ticket's Requirements, and each is recorded in a ticket comment.
3. Robin applies `Agreed`. Implementation starts only then (AGENTS.md).
4. **Branch from `main`, not from a prototype branch.** Name it `<number>-<Title>`, such as `NN-Adopt-the-Modern-design`. Production must not pick up `prototypes/` or `src/prototypes/`. Prototype code is a reference to copy from, not a dependency.

## 3. Production compared with Modern

Production is `src/App.tsx` (613 lines: the `Task` card and `App`), `src/index.css` (917 lines, one global stylesheet), the dictation components in `src/dictation/`, and `AccountControl` in `src/account/`. Modern is `src/prototypes/modern/ModernApp.tsx` and `modern.css` on the prototype branch.

### 3.1 Functionality Modern must preserve

| Production behaviour | Where it lives | What Modern does | What production needs |
| --- | --- | --- | --- |
| Tasks saved to `taskmanager.tasks` on every change, loaded with `loadTasks`, sample tasks on first visit, in-memory fallback when storage fails | `App.tsx` effect, `tasks.ts` | In memory only | Keep exactly. No schema or key change. |
| Assignee filter saved to `taskmanager.assigneeFilter`, restored on load, unknown ids fall back to All | `assigneeFilter.ts` | Not persisted | Keep `loadAssigneeFilter` / `saveAssigneeFilter`; the sidebar list drives the same state. |
| Filtered drag reorders the full list by full-list index | `getVisibleTasks`, `reorderTasks` | Reorders by id lookup in the full list | Keep `getVisibleTasks` indexes and react-dnd's `index`. |
| react-dnd with the HTML5 backend, move on hover past the row's midpoint | `Task` in `App.tsx` | Native HTML5 drag events, armed only from the grip | Keep react-dnd (no new dependency, same feel). Decide drag surfaces (D6). |
| Add Task: appended at the end, assignee from filter or first user, priority 3, due today, title "New task" focused and selected | `addTask` | Same, except ids from a counter | Keep production's `addTask` as is. |
| Delete: no confirmation, `dictation.removeTarget(id)`, focus to next visible task's Delete button, else previous, else Add Task | `deleteTask`, `focusAfterDelete.ts` | Calls `dictation.stop`, focuses next task's title | Keep `removeTarget`. Focus target needs a decision, because Delete moves into the panel (D2). |
| Reset to sample tasks: below the list, no confirmation, removes every dictation target | `resetToSampleTasks` | Stops dictation and closes the panel | Keep production's version, and also close the panel. |
| Due-state thresholds: overdue < 0, due soon 0-1 days, this week 2-3 days, later, none, completed | `getBackgroundClass` in `App.tsx` | `getTaskState` in `src/prototypes/sampleTasks.ts`, same thresholds | Extract one pure helper into `dueDates.ts` (step 1). |
| Wording "2 days overdue", "Due today", "3 days remaining", "No due date", "Completed" | `describeDueStatus` | Same wording, plus a short date | Keep wording. Short date is D9. |
| Deadlines follow midnight while the page is open | `useToday` | Fixed `today` for the session | Keep `useToday`. Quick dates must use it too. |
| Accessible names from `getTaskControlNames`, including "untitled task N" | `taskControlNames.ts` | Uses it, adds "Edit details for ..." | Keep. Add a name for the summary button and the quick-date buttons. |
| Priority 1-5 with value text "n of 5" | range input | Five radios, bars and number on the row | D3. |
| Assignee per task, options sorted by name | `<select>` | Photo-chip radios, sorted | D4. |
| Completed checkbox named "Complete *task*" | checkbox with visible "Complete" | Round checkbox, no visible word | D7. |
| Title edited inline; blank titles allowed and saved | `<input type="text">` | One-line-behaving `<textarea>` that wraps | D8 and section 4. |
| Analytics in `main.tsx`; `?user=` testing label applied at start | `main.tsx` | Not loaded | Untouched. |
| Account: unavailable / Sign in with Google / Signed in as ..., profile panel, alert messages | `AccountControl` | Placeholder button in the sidebar foot | Real `AccountControl` in the sidebar (D12). |
| Dictation hint, retention notice "This demo may retain dictated text for diagnostics." | `DictationHint`, `App.tsx` | Same text in the sidebar | Keep exact notice text (it is a disclosure). Hint placement D11. |

### 3.2 Differences by area

- **Creation.** Same rules. Modern adds no new defaults. Under a filtered view the new task appears in the visible list; the panel stays closed and focus goes to the title, as now.
- **Editing.** Production shows every control on every card. Modern shows the title and checkbox on the row, a read-only summary button, and edits due date, priority, assignee and Delete in a panel beneath the row (one panel open at a time). Opening a panel is one extra click for those three fields.
- **Completion.** Same field. Modern moves the checkbox to the start of the row, drops the visible word and strikes completed titles through. Production dims the whole card with `opacity: 0.75`.
- **Deletion.** Production: one click on the card. Modern: open panel, then Delete. Neither confirms.
- **Ordering.** Same manual order. Modern's grip is the only drag surface and is hidden until hover or focus.
- **Priority.** Slider replaced with five buttons in the panel; rising bars plus number on the row.
- **Assignee.** Select replaced with photo chips; row shows avatar plus name. Modern's avatar falls back to initials when a photo fails, which production does not.
- **Filter.** Select replaced with a sidebar list with counts; heading names the view ("Bob's tasks"); count becomes "2 of 7 tasks" when filtered; new empty-state text "No tasks for Bob.".

### 3.3 Dictation, Speechmatics and the level meter

Speechmatics integration (`speechmaticsAdapters.ts`, `dictationSession.ts`, `dictationController.ts`, the `/api/dictation/*` endpoints, activity and transcript reporting, `dictation.config.toml`) does not change. The redesign touches only how dictation is attached to titles and where its feedback is shown.

Must keep:

- The microphone button per title, built on production's `DictationButton`, which calls `dictation.registerButton` so that Ctrl + Alt works while the button has focus. Modern's own button does not register itself.
- `onMouseDown` `preventDefault` on the microphone, and on every dictation setting, so that the caret stays in the title.
- Ctrl + Alt toggling from a focused title or microphone (`ctrlAltShortcut.ts`).
- Stopping when focus leaves the titles, except to elements inside `[data-dictation-setting]`. In Modern, the Settings button and the `<dialog>` must carry that attribute (they do in the prototype), and so must anything else that holds the meter choice. Opening a details panel stops dictation, which matches production (any other control stops it).
- Stopping when the task being dictated into is deleted, via `dictation.removeTarget`, and clearing targets on Reset.
- Text settling into a task that is filtered out (targets outlive inputs).
- `recordEdit(before, after)` on every user edit of a title, with the value actually stored.
- The status box's `role="status"` live region, always in the DOM even when empty, with the level meter outside the live text. Modern's floating pill keeps this; it must keep it when hidden (hide visually, not with `display: none` on the live region).
- `LevelMeter` and its fixed class names (`.level-meter*`, `--level`, `--peak`, `--past`). The meter's rules must move into the new stylesheet unchanged in behaviour; meter designs are out of scope.
- Meter choice in memory only, changeable while dictating.
- Unavailable states: "checking", "not_configured" and "unsupported" titles and messages from `DictationButton` and `describeUnavailability`. Modern only simulates two of them.
- Reduced motion: the meter moves in steps; any pulsing ring on an active microphone must stop.

### 3.4 Authentication, persistence, retention and settings

- **Authentication.** `AccountControl` and `useAccount` stay as they are. Only their position and styling change (D12). The account panel was out of scope for TM #56; keep its content and behaviour.
- **Persistence.** Unchanged keys and shapes: `taskmanager.tasks`, `taskmanager.assigneeFilter`, `taskmanager.activityUser`. Which row is expanded is UI state and is not saved. No migration is needed because `TaskType` does not change. Quick dates write the same `yyyy-MM-dd` string.
- **Retention.** The notice text stays word for word and stays visible without interaction (in the sidebar). Server-side transcript and activity storage is untouched.
- **Settings.** Modern puts the level meter choice in a Settings dialog (D13). No other existing control is a preference, so Settings would hold only the meter for now.

### 3.5 Keyboard, focus and layout

- Tab order per row in Modern: checkbox, title, microphone, summary button (four stops, against seven now). In the panel: date, quick dates, priority radios (arrow keys), assignee radios (arrow keys), Delete.
- Escape closes the panel and returns focus to the summary button. Production has no Escape handling today, so this is new (D14).
- A keyboard activation of the summary button keeps focus on it; a pointer click on a part focuses that field (`event.detail === 0` test).
- Hidden grip and microphone use opacity, stay in the tab order, and reappear on `:focus-within`.
- Visible focus everywhere; WCAG AA text contrast; 3:1 for control edges; state never by colour alone (Modern uses a distinct icon per due state).
- Layout: Modern is written for 1280 px and 1024 px, with a narrower sidebar below 1180 px. Production currently adapts down to 640 px (breakpoints at 1137, 850, 780 and 640 px) and FUTURE_CONSIDERATIONS records that it was usable on Robin's iPhone. Modern has no layout below about 1024 px, so adopting it as is would be a regression on narrow screens (D15).

### 3.6 Prototype-only assumptions that cannot carry into production

- The reviewer bar, simulated dictation (`simulatedDictation.ts`), the prototype sample tasks (`createPrototypeTasks`, seven tasks) and `getTaskState` from `src/prototypes/`. Production keeps `createSampleTasks` (five tasks) unless D17 says otherwise.
- A fixed `today` for the page's life.
- Native drag events in place of react-dnd.
- No storage reads or writes; no `/api` calls.
- The placeholder "Sign in with Google" button.
- `alphabeticalUsers` built once at module level from a constant list; production sorts `users` state.
- Counter-based ids (`p-new-N`). Production's `task-${Date.now()}` ids stay, because saved data already uses them.
- Modern's `DictationButton` and `DictationStatus` copies. Production keeps its own components and restyles them.
- Modern has never been seen in a browser by an agent. Its layout figures (about 460 px of title at 1280 px, 345 px at 1024 px) are calculated, not measured.

## 4. Technical pitfalls found while planning

- **The title becomes a text area, and dictation is typed for inputs.** `useDictation` stores `HTMLInputElement`s, `focusInput` and `getInputSelection` read selections, and `scrollCaretIntoView` in `caretScroll.ts` scrolls a single-line input horizontally. `createDictationTargets` is already generic over a `TargetInput` shape that a text area satisfies. Needed: widen `registerInput` and the maps to `HTMLInputElement | HTMLTextAreaElement`, and make `revealCaret` do nothing for a text area that grows to fit (or scroll the page vertically if the caret is off screen). This is the riskiest part of the change and should be its own step with tests.
- **Line breaks.** Modern replaces pasted line breaks with spaces in `onChange`. Production must call `dictation.recordEdit(id, before, sanitised)` with the sanitised value, or dictation's insertion point would drift. Dictated text never contains line breaks, but this should be tested.
- **Text area height.** Use `scrollHeight + offsetHeight - clientHeight`, refit on `task.text` change and on window resize (Modern's `fitToContent`). With dictation writing through `flushSync`, refit in a layout effect so the row does not jump.
- **Drag and text selection.** If the row is the drag source, mouse selection in the title can break. Arm dragging only from the grip, or keep react-dnd's drag source on the grip element only.
- **`:has()`** draws chip and segment states; supported from Chrome 105, Safari 15.4 and Firefox 121. Tick marks use `content: "\2713" / ""` (Firefox 128+). Acceptable for this app, but note it.
- **Sticky status pill** needs the main area to be its own scroll container of known height.
- **ESLint `react-hooks/purity` and `react-hooks/refs`** flagged patterns in the prototypes (`Date.now()` in a handler, reading `ref.current` in JSX). Production's `Date.now()` in `addTask` passes today; check again after restructuring.
- **Static-markup tests** in `src/*.test.ts` split the rendered page on `<div class="task ` and look for specific classes and text. They will all need rewriting once the markup changes (section 7).
- `src/dictation/speechmaticsAdapters.node.test.ts` ("stops a connection that is closed while still connecting") fails in the cloud sandbox on unchanged `main`. Recheck locally before treating it as a regression.

## 5. Decisions requiring Robin's approval

Each needs an answer before the implementation ticket is agreed. "Proposed" is this plan's recommendation, not an adopted behaviour.

**From Modern**

- **D1. Details in a panel beneath the row.** Due date, priority, assignee edited in the panel; one more click than now. Proposed: adopt (it is the core of the approved direction), one panel open at a time.
- **D2. Delete moves into the panel** (two clicks, still no confirmation). And where focus goes after Delete, since the next task's Delete button is no longer on screen. Proposed: adopt; focus goes to the next visible task's summary button, else the previous one's, else Add Task (same order as `findTaskToFocusAfterDelete`). Modern's prototype sends it to the title.
- **D3. Priority slider replaced** by five buttons in the panel, and bars plus the number on the row. Proposed: adopt.
- **D4. Assignee select replaced by photo chips.** Fine for four people, not for many (TM #44 "Manage assignees" may add more). Proposed: adopt chips now; revisit with TM #44.
- **D5. Assignee filter as a sidebar list with counts**, heading naming the view, and "2 of 7 tasks" while filtered (production always shows the total). Also the new empty-state line. Proposed: adopt, keeping persistence.
- **D6. Grip and microphone hidden until hover or focus.** The hint says "click its microphone button", which is not visible until hover. Drag surfaces shrink from handle, photo and details space to the grip alone. Proposed: keep both always visible but quiet in the first release (lower risk, matches the hint, suits touch), and treat hover-reveal as a separate later decision. Grip as the only drag surface: adopt.
- **D7. Round checkbox at the start of the row**, no visible "Complete", completed titles struck through, no card opacity. Proposed: adopt.
- **D8. Long titles wrap** in a text area that behaves as one line (Enter does nothing; pasted line breaks become spaces). Saved titles are unchanged. Proposed: adopt; it is the main readability gain. Note the dictation work in section 4.
- **D9. Due state as icon and text in a column**, tinted pill only for overdue and due soon, and a short date added ("3 Nov"). This removes the documented pastel pink overdue background and the red border under reduced motion, both described in README. Proposed: adopt and update README.
- **D10. Summary line** "1 overdue · 2 due soon · 1 completed", counted over tasks on show. New information. Proposed: adopt (cheap, pure, testable), or drop if Robin prefers no new information.
- **D11. Page structure.** "Task Manager" moves to the sidebar; the page heading names the view; column labels added; dictation hint and retention notice move to the sidebar. TM #59 (DRAFT, "Add a dictation hint") also concerns the hint. Proposed: adopt, and tell TM #59 where the hint now lives.
- **D12. Account control in the sidebar foot** instead of above the header. The profile panel then needs room: open it as a panel above the sidebar foot, or keep the account bar at the top right of the main area. Proposed: top right of the main header, which leaves `AccountControl` and its panel nearly untouched.
- **D13. Level meter choice in a Settings dialog** opened from the sidebar, instead of buttons above the list. Proposed: adopt.
- **D14. Escape closes the panel** and returns focus to the summary. New keyboard behaviour. Proposed: adopt. Also check that it does not conflict with TM #34 (keyboard shortcuts, DRAFT).
- **D15. Narrow widths.** Production adapts down to 640 px; Modern stops at about 1024 px. Mobile is low priority, but a regression is still a change. Proposed: below about 900 px, the sidebar moves above the list as a compact bar (filter as a select or a wrapped list), the column labels hide and the summary wraps under the title. Robin to say what minimum width must keep working.
- **D16. Indigo accent** instead of production blue. Proposed: adopt Modern's palette.
- **D17. Sample tasks.** Keep production's five `createSampleTasks`, or adopt the prototypes' seven (which add due soon and no due date). Changing them changes what a first visit and "Reset to sample tasks" show. Proposed: keep production's set; a separate ticket can change it.
- **D18. Avatar initials fallback** when a photo fails to load. Proposed: adopt (it only replaces a broken image).

**From Docket**

- **D19. Quick due dates in the panel**: Today, Tomorrow, In a week (today + 7 calendar days), from the live `useToday` date. Approved in direction. To confirm: (a) the button matching the current date shows as pressed (`aria-pressed`), as in Docket; (b) the button keeps focus after a click, and the panel stays open.
- **D20. "No date" button.** Docket also has a one-click "No date". Production clears a date only through the date input. Robin's direction lists three actions, so the proposed default is to leave "No date" out.

## 6. Implementation sequence

Each step is a commit (or small group of commits) on the implementation branch that leaves the app working, with `npm run build`, `npm run lint` and `npm test` passing. Categories: **S** structural and visual, **B** behavioural, **P** production integration, **A** accessibility and responsive, **T** testing and browser verification.

### Step 1: Groundwork, no visible change (P, T)

- Move the due-state rules out of `getBackgroundClass` into a pure `getDueState(dueDate, completed, today)` in `src/dueDates.ts`, returning `overdue | due-soon | due-this-week | due-later | no-due-date | completed`. Use it in `App.tsx` for the existing classes. Unit tests at each threshold, a month end and a year end.
- Add `getQuickDueDates(today)` to `src/dueDates.ts` (copy from `src/prototypes/distinctive/docket.ts`, Today, Tomorrow, In a week only). Tests across month, year and a daylight-saving change.
- If D10 is adopted, add a pure `summariseDueStates(tasks, today)` with tests.
- Widen dictation to text areas (section 4): types in `useDictation.ts`, `revealCaret` that skips text areas, `dictationTargets.test.ts` cases with a text-area-like target, and a test that `recordEdit` gets the sanitised value. Titles are still inputs at this point, so behaviour is unchanged.
- Verify: build, lint, test; the app looks and behaves exactly as before.

### Step 2: New stylesheet and shell (S, P)

- Replace `src/index.css` with Modern's tokens and layout, adapted: production class names where tests or components depend on them (`level-meter*`, `dictation-*` where kept), the account styles, and reduced-motion rules. Keep styling in `src/index.css` (AGENTS.md); do not add a second global stylesheet. Leave the unused `src/App.css` alone (out of scope).
- `App` renders the shell: sidebar (brand, assignee list driving the persisted filter, dictation hint, retention notice, Settings button), main header (view heading, count, optional summary line, Add Task, account control per D12), column labels, list, Reset, status.
- Keep the current `Task` card inside the new shell for this step, so the shell can be checked on its own.
- Verify: filter persistence across reload, Add Task under a filter, Reset, sign-in unavailable state, and analytics still loaded.

### Step 3: Compact rows (S, B, P)

- Rewrite `Task` as a row: grip (react-dnd drag source, D6), round checkbox, title, production `DictationButton`, and the summary button (due icon and text, priority bars and number, avatar and name). Consider moving the row and panel into `src/TaskRow.tsx` so `App.tsx` stays readable; no other new modules.
- Title: switch to the wrapping text area (D8) with `fitToContent`, Enter suppressed, line breaks sanitised, `recordEdit` with the stored value, registered with both `dictation.registerInput` and `registerTitleInput`.
- Keep the drop target on the whole row with the midpoint rule; keep full-list indexes.
- Verify: drag under All and under a filter, then reload; dictation into a wrapped long title; Ctrl + Alt from a title and from a focused microphone; focus leaving stops dictation.

### Step 4: Details panel and quick dates (S, B)

- Panel beneath the row: date input, Today / Tomorrow / In a week (D19, D20), priority radios (D3), assignee chips (D4), Delete (D2). One open at a time; expanded id held in `App` state; pointer click on a summary part focuses that field.
- Escape (D14) and focus after Delete (D2). Delete still calls `dictation.removeTarget`; Reset closes the panel.
- Verify: every field writes to saved data and survives reload; deleting the task being dictated into stops dictation; focus lands as decided.

### Step 5: Dictation feedback and Settings (S, P)

- Restyle production `DictationStatus` as Modern's pill at the foot of the list, keeping the always-present live region and the meter outside it.
- Move `MeterStyleSelector` into a native `<dialog>` (D13), with `data-dictation-setting` on the dialog and the Settings button, `mousedown` prevented on the button, and focus returned to the active title (or the Settings button) on close.
- Verify (manually, since live dictation is not allowed in browser checks): changing the meter while dictating does not stop dictation; every phase and stop message shows; "not configured" titles show on every microphone.

### Step 6: Accessibility and responsive refinements (A)

- Contrast of every token pair, recalculated against the final palette; focus ring visible on every control including chips, segments and the round checkbox; state never by colour alone.
- Reduced motion: transitions and any microphone pulse off; meter stepping unchanged.
- Narrow layout per D15, then check at 1280, 1024 and the agreed minimum width.
- Accessible names: "Edit details for *task*", described by the summary; quick-date buttons named with their task, such as "Due today for *task*", or grouped under the due-date group's name.

### Step 7: Documentation (P)

- README: replace the pastel pink, red border, "Assignee dropdown above the task list", "Level meter, above the task list" and status-box descriptions with the new ones; describe quick dates and the panel.
- FUTURE_CONSIDERATIONS: update "Layout on narrow screens" with what was done.
- Leave `prototypes/` on its branch; do not copy it to `main`.

### Step 8: Tests and browser verification (T)

See section 7. Then the mandatory independent review (AGENTS.md), recorded in the pull request description.

## 7. Tests

### Existing tests that must change

- `src/sampleTasksDisplay.test.ts`: splits markup on `<div class="task `, checks classes `task-completed` and `task-overdue`, the text "Priority: 5/5" and `aria-valuetext="5 of 5"`, the exact `dictation-notice` paragraph, the Reset button's position before `</section></main>`, the hint's exact markup, the empty status paragraph, and the meter buttons' markup. Rewrite against the new row markup, keeping each test's intent: completed task first and not overdue, no inline animation, notice present, Reset below the list in every view, control names, hint wording, empty status, meter defaults.
- `src/unsetDueDateDisplay.test.ts`: checks `task-normal` and `<span>No due date</span>`. Rewrite against the due column, keeping "No due date", "Completed" and no "NaN".
- `src/assigneeOptions.test.ts`: counts six `<select>`s and reads options from them. Rewrite to check the sidebar filter order (All assignees, then alphabetical) and each panel's chip order. Panels are closed in static markup, so render one open or test the ordering helper directly.
- Unchanged and still relevant: `tasks.test.ts`, `dueDates.test.ts`, `today.test.ts`, `assigneeFilter.test.ts`, `users.test.ts`, `focusAfterDelete.test.ts` (extend if D2 changes the target element), `taskControlNames.test.ts` (extend for new names), and all dictation and server tests.

### New tests

- `getDueState` thresholds; `getQuickDueDates` across month, year and DST; `summariseDueStates` if D10.
- Title sanitising (line breaks to spaces) and `recordEdit` receiving the stored value.
- Dictation targets with a text area: insertion, selection restore, `revealCaret` skipped.
- Static-markup tests for: the sidebar filter with counts and pressed state; "N of M tasks" when filtered; the summary button's name and description; every due state's icon class and text; the Settings button and dialog carrying `data-dictation-setting`; the status live region present while empty.
- The project has no component test library, so open-panel, Escape and focus behaviour can only be checked in a browser unless one is agreed (FUTURE_CONSIDERATIONS notes the same gap).

### Browser verification (AGENTS.md rules)

Use `npm run dev:browser-check` at `http://127.0.0.1:5183` through the Playwright MCP server, starting from "Reset to sample tasks". In the cloud sandbox the MCP server refuses to start because `PLAYWRIGHT_*` variables are set, so this has to run in a local Claude Code session or be done by Robin.

Checklist:

1. Layout at 1280 px, 1024 px and the agreed minimum; columns line up with labels; long title wraps fully.
2. Add, edit title, complete, uncomplete, delete, reset; reload after each to confirm persistence.
3. Panel: open by click on each summary part and by keyboard; quick dates set the expected dates and show as pressed; date input; priority and assignee by mouse and arrow keys; Escape; focus after Delete.
4. Drag by the grip under All and under a filter; reload; text selection in titles still works.
5. Filter: counts, heading, "N of M", empty state, persistence across reload.
6. Dictation with dictation not configured (the only state allowed in checks): microphone titles, the message on click, Ctrl + Alt, Settings dialog open and close.
7. Keyboard-only pass of the whole page; focus ring visible everywhere.
8. Reduced motion emulated.
9. Account: "Sign-in is unavailable" placement.

Manual checks for Robin (not allowed in agent checks): live dictation into a wrapped title, the level meter while listening and while changing its style, live sign-in and the profile panel.

## 8. Risks and unknowns

- **Modern has not been seen in a browser by any agent.** Robin's local view is the only visual check so far; layout bugs may remain in the prototype and would carry over.
- **Dictation into a text area** is new ground for `useDictation`; it is the largest behavioural risk and is tested in step 1 before the title changes.
- **react-dnd with a grip-only source and a wrapping text area** has not been tried.
- **Narrow layouts** have no Modern design yet (D15).
- **Account panel placement** (D12) is untried in any prototype.
- **Browser support** for `:has()` and the `content` alternative-text syntax (recent browsers only).
- **Overlap with open tickets**: TM #59 (dictation hint), TM #34 (keyboard shortcuts), TM #23 (reordering without dragging), TM #38 (undo delete and reset), TM #39 (Today view), TM #40 (search and filters, which the sidebar suits), TM #44 (manage assignees, which chips do not scale to), TM #25 (task notes, which a panel suits). None blocks this work, but each should be told where its UI will now live.
- **Sandbox test failure** in `speechmaticsAdapters.node.test.ts` on unchanged `main`.
- **Static-markup tests** give limited coverage of interaction; most interaction checks depend on a browser.

## 9. Out of scope

Dark mode, new features, meter redesigns, account panel redesign, server and Speechmatics changes, saved-data changes, Docket's dock and style, removing `src/App.css`, and deleting any prototype branch (Robin's decision 3 on TM #56 keeps them permanently).
