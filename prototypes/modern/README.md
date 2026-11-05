# Prototype 2: Modern

The second TM #56 concept: a contemporary productivity layout. A sidebar holds navigation, people and dictation help. The main area is a compact list aligned in columns. Each task is one slim row with its full title, and its details are edited in a panel that opens beneath the row.

**Status:** built, not yet seen in a browser. See [Verification](#verification).

**View it:** run `npm run dev` and open <http://localhost:5173/prototypes/modern/>. If port 5173 is busy, Vite picks the next free one (Robin's screenshots used 5174), so use the port Vite prints. The list of all prototypes is at `/prototypes/`.

## What to try

- **Read the list.** Seven tasks, one line each, except the long onboarding title, which wraps onto a second line instead of being cut off. Due state, priority and assignee line up in columns under small labels.
- **Edit a title** by clicking it. It reads as text, shows an edge on hover and an indigo ring when focused. Enter does nothing, as in the app; pasted line breaks become spaces.
- **Tick the round checkbox** on the left to complete a task. The title is struck through and the due column says "Completed".
- **Open a task's details** by clicking anywhere in its due / priority / assignee summary. A click on one part focuses that field: click the avatar and the assignee choice has focus. The panel has the due date, priority as five buttons (1 to 5), the assignee as photo chips, and Delete. Escape, or another click on the summary, closes it.
- **Change the due date** in the panel, or clear it for "No due date". The row updates as you type.
- **Hover a row** to reveal the drag grip on the far left and the microphone after the title. Both also appear when anything in the row has keyboard focus.
- **Drag a task** by its grip.
- **Filter by assignee** in the sidebar. The heading becomes "Bob's tasks", the count "2 of 7 tasks", and Add Task assigns new tasks to that person, as in the app.
- **Dictate:** click a microphone. A dark status pill rises at the foot of the list: "Connecting", then "Listening" with the level meter, then "Finishing" and "Dictation stopped." when you click it again. Moving focus out of the titles stops it, as in the app.
- **Settings** at the foot of the sidebar opens the level meter choice, with a live preview.
- **Keyboard:** Tab goes checkbox, title, microphone, summary button, then the next row. In the panel, the arrow keys move between priorities and between people.
- **Reviewer bar** (dark strip at the top, not part of the design): switch dictation to "Not configured", or show the grip and microphone all the time instead of on hover.
- **Narrower window:** below 1180 px the sidebar narrows, the assignee column shows the photo alone, and the short date beside the due state is hidden.

Not simulated, as in Refined: the Ctrl + Alt shortcut, inserting dictated text, persistence, sign-in (the button does nothing) and the account panel.

## Design rationale

Robin's screenshots of the app and of Refined show the same problem in both. Every row is about 100 px tall and carries seven controls in a fixed strip on the right: microphone, priority label and slider, assignee select, Complete, Delete. These take roughly half the width, so the title, the one thing a list is for, gets what is left and is cut off ("Update the onboarding documentation for contributors joini..."). The eye goes to the controls first. Refined made that strip tidier but kept it.

Modern starts from the opposite end: **the row is for reading, the panel is for editing.**

- **Title first.** The title takes all the width the columns leave (about 460 px in a 1280 px window, worked out from the CSS) with nothing beside it competing, and wraps when it needs to. It is 15 px semibold, the largest and darkest text in the list.
- **Details as a summary, not as controls.** Due state, priority and assignee are shown as read-only text and icons in three aligned columns, so the list can be scanned down a column ("what is overdue?", "what is Charlie doing?"). They are one button: one tab stop per row instead of five.
- **Editing in place, one task at a time.** A click on the summary opens a panel below the row with proper controls. It is in the list, so the context stays visible, and it shows only one task's controls at a time.
- **Urgency stands out, everything else steps back.** Only overdue and due-soon tasks get a tinted pill (red and amber). This week is amber-brown text, later is grey, no date is grey italic with a dash, and completed is green with a tick. Each state has its own icon (triangle, clock, calendar, arrow, dash, tick), so colour is never the only signal. There is no card tint and no coloured edge.
- **Priority you can see down the column.** Five rising bars filled to the priority, plus the number. The slider goes; in the panel, priority is five buttons, so any value is one click.
- **Completion where the eye starts.** A round checkbox at the start of the row, as most task apps have it. Completed tasks are struck through and muted, and their bars turn grey.
- **Secondary controls out of the way.** The grip and microphone appear on hover or focus, and Delete is in the panel. The reviewer bar can show grip and microphone permanently, to judge what hiding them gains.
- **Horizontal space.** The app's header spends a whole band on the title, a two-line hint and a button, and a second band on the controls row. Modern moves the app name, the assignee filter, the dictation hint, the retention notice, Settings and sign-in into a 248 px sidebar. The main area keeps only a heading, the count, Add Task, column labels and the list. Seven tasks take about 310 px of height, where the app's rows take about 110 px each.
- **Vertical space.** Rows are 44 px. The dictation status takes no space at all until there is something to say, then floats as a pill at the foot of the visible list, near where the user is looking while dictating.
- **Identity.** White page, pale grey sidebar, hairline row dividers instead of cards and shadows, one indigo accent (`#4f46e5`) instead of the app's blue, small uppercase labels for sections and columns, tabular figures for dates and counts, and the system font throughout. It is deliberately calm, so that state colours carry meaning.

### Layout at a glance

```
+--------------------------------------------------------------------------------+
| Reviewer bar (not part of the design)                                          |
+------------------+-------------------------------------------------------------+
| [#] Task Manager |  All tasks                                     [+ Add Task] |
|                  |  7 tasks · 1 overdue · 2 due soon · 1 completed             |
| ASSIGNEE         |                                                             |
| (o) All      7   |  TASK                       DUE             PRIORITY ASSIGNEE|
|  A  Aaron    1   |  ------------------------------------------------------------|
|  A  Alice    2   |  : ( ) Fix authentication bug  [! 2 days overdue · 3 Nov] |||| 5 (B) Bob  v |
|  B  Bob      2   |  : ( ) Prepare sprint demo     [o Due today · 5 Nov]      |||  4 (A) Alice v |
|  C  Charlie  2   |  ...                                                        |
|                  |  : ( ) Update the onboarding documentation   -> 10 days ... ||| 3 (C) ... v |
| DICTATION        |        for contributors joining the project next month      |
| hint, notice     |  : (v) ~~Deploy initial build~~  v Completed · 2 Nov ...    |
|                  |                                                             |
| Settings         |                       ( * Listening  [meter] )              |
| Sign in          |                                     Reset to sample tasks   |
+------------------+-------------------------------------------------------------+
```

When a row is open, a white panel appears beneath it, indented to the title:

```
DUE DATE         PRIORITY              ASSIGNEE                                  
[05/11/2026]     [1][2][3][4][5]       (A Aaron) (A Alice ✓) (B Bob) (C Charlie)    [Delete]
```

## Files and architecture

```
prototypes/modern/
  index.html          Entry page; loads /src/prototypes/modern/main.tsx
  README.md           This write-up
src/prototypes/modern/
  main.tsx            Mounts ModernApp with modern.css; no app CSS, no analytics
  ModernApp.tsx       The whole Modern page, in one file
  modern.css          All Modern styling: tokens, layout, components, level meter rules
```

- Shared with Refined: only `src/prototypes/sampleTasks.ts` (the seven tasks, users and `getTaskState`) and `src/prototypes/simulatedDictation.ts`. No Refined component, class or token is used. Class names start with `md-` and tokens with `--md-`.
- From the app, the same pure imports as Refined: `describeDueStatus`, `getDaysUntilDue`, `getTaskControlNames`, `sortAssigneesByName`, `reorderTasks`, `describeDictationPhase`, `LevelMeter` and `MicrophoneIcon`. The rules about what not to import are in `prototypes/README.md`.
- `ModernApp.tsx` is organised top to bottom as: icons, small pieces (`Avatar`, `PriorityBars`), dictation (`DictationButton`, `DictationStatus`), the Settings dialog, the details panel (`TaskDetails`), the row (`TaskRow`), the `Sidebar`, the `ReviewerBar`, and `ModernApp`, which holds all state.
- State in `ModernApp`: tasks, assignee filter, which row is open (and which field to focus), simulated dictation, meter choice, the dragged task, and the two reviewer options. Nothing is persisted.
- Layout: the page is a flex column filling the window. Below the reviewer bar, a two-column grid holds the sidebar and a scrolling content area (`.md-content`). The column labels and each row share one grid (`16px 20px 1fr auto`); the summary button has its own three-column grid whose widths come from `--md-col-due`, `--md-col-priority` and `--md-col-assignee`, and the column labels use the same variables, so they line up.
- `modern.css` is about 1,390 lines: tokens at the top with contrast ratios noted, then sections for the reviewer bar, shell, sidebar, main, buttons, rows, panel, status, dialog, narrower widths, reduced motion and, at the end, the level meter rules copied from Refined with Modern's token names.

## Proposed behaviour changes

None of these is adopted. Each needs Robin's decision before it could reach the app. The bigger ones come first.

1. **Details are edited in a panel beneath the row, not on the card.** The row shows due state, priority and assignee as a read-only summary. Changing any of them takes one click to open the panel and one to change the value, where the app takes one. Only one panel is open at a time. Is the cleaner list worth the extra click?
2. **Delete moves into the panel.** Deleting takes two clicks. It still has no confirmation, as now. The question is whether Delete should be one click from the list.
3. **Priority slider replaced.** The row shows five rising bars and the number. The panel has five buttons, 1 to 5, a radio group, so the arrow keys work. Any priority is one click, rather than a drag.
4. **Assignee select replaced by photo chips** in the panel, also a radio group. This suits four people and would not suit many more. A select, or a searchable menu, would be needed beyond about six.
5. **Assignee filter becomes a sidebar list with counts** ("Bob 2"). The counts are new information. The heading names the view ("Bob's tasks"), and the count becomes "2 of 7 tasks" while filtered; the app always shows the total.
6. **Grip and microphone hidden until the row is hovered or has focus.** The microphone stays visible while it is dictating. The dictation hint still says "click its microphone button", which a new user may not see until they hover. The reviewer bar shows the alternative.
7. **Completion moves to a round checkbox at the start of the row**, without the word "Complete" (its accessible name is still "Complete *task*"). Completed tasks are **struck through**, muted, and their priority bars turn grey.
8. **Long titles wrap** onto as many lines as they need. The title becomes a text area that behaves as one line: Enter does nothing and pasted line breaks become spaces. Saved titles are unchanged.
9. **Due state shown as text and icon in a column**, with a tinted pill only for overdue and due soon. No card tint, so the documented "pastel pink background" for overdue tasks goes, as does the red border added under reduced motion. A short date ("3 Nov") is added after the app's wording. The full date is seen only in the panel's date field.
10. **A summary line under the heading**: "1 overdue · 2 due soon · 1 completed", counted over the tasks on show. New information.
11. **Page structure:** "Task Manager" moves from the heading to the sidebar, and the page heading names the view. The dictation hint, the retention notice, Settings and sign-in move into the sidebar. Column labels (Task, Due, Priority, Assignee) are added above the list.
12. **Dictation status becomes a floating pill** at the foot of the visible list, hidden when there is nothing to say, instead of a box with reserved space in the controls row. Its wording and states are the app's.
13. **Level meter choice in a Settings dialog**, as Refined proposed, opened from the sidebar. Its options are pill-shaped radio buttons instead of toggle buttons.
14. **Focus after Delete** moves to the next task's title, or the previous one if it was the last, or Add Task if the list is empty. Escape closes the details panel and returns focus to the summary.
15. **Accent colour** changes from the app's blue to indigo.

## Advantages

- The list can be read. Every title is shown in full, and rows are less than half the height of the app's.
- Scanning works by column: urgency, priority and owner each have a fixed place.
- Visual noise falls sharply: one quiet button replaces five controls on each row, and colour is kept for meaning.
- Fewer tab stops: four per row (checkbox, title, microphone, summary) instead of seven.
- The page has a clear structure (navigation left, content right) that will take future views, such as more filters, without crowding the header.
- Still all native elements: inputs, radios, a text area, a `<dialog>`.

## Trade-offs

- Changing a detail takes one more click, and Delete is less direct.
- Hidden grip and microphone are less discoverable, and do not suit touch. Desktop is the priority, but this would need revisiting for touch.
- Photo chips do not scale to many people.
- The sidebar costs about 250 px of width, which is fine at 1280 px and tight below 1024 px. Narrow screens are out of scope, but a collapsible sidebar would be needed eventually.
- It looks like many other task apps. That is partly the point, but it gives TaskManager less character than Distinctive may.
- More markup change than Refined, so more to test in the app: drag and drop, focus, and the panel.

## Implementation complexity

Medium.

- **Markup in `App.tsx`:** the `Task` component is rewritten: row, summary button, panel, round checkbox, text area title. The header and controls row become a sidebar and a lighter header.
- **Behaviour:** which row is open becomes UI state, with focus handling on open, close, Escape and delete. The text area needs sizing to its content (about ten lines here) and newline handling.
- **Drag and drop:** react-dnd's drag source would move to the grip alone; the app now also uses the photo and the space in the details line.
- **Dictation:** the title becomes a text area, so the dictation code that inserts text into the title must work with one. That needs checking in `useDictation`.
- **CSS:** a new stylesheet in place of most of `index.css`. Its tokens would make later changes cheap.
- **Tests:** unit tests for the summary count text if kept, and browser checks of focus order, the panel, drag and drop and refresh persistence. No change to saved data.

## Would a component library help?

Not much yet. Everything here is native: radio groups give arrow-key behaviour for free, `<dialog>` gives focus trapping and Escape, and the disclosure is a button with `aria-expanded`. A library would start to pay off if the panel became a popover anchored to the summary, or the assignee chips became a searchable menu, because positioning, dismissal and focus return are where hand-built widgets usually go wrong. If that is wanted, a headless library (unstyled behaviour only) would fit better than a styled one, and would still be a new dependency needing agreement.

## Technical discoveries and pitfalls

- **Sizing a text area to its content.** Setting `height` to `scrollHeight` leaves the last line about 2 px short, because `scrollHeight` leaves out the border and the height (with `box-sizing: border-box`) includes it. Add `offsetHeight - clientHeight`. The text area also has to be resized when the window width changes, since that changes where it wraps; Modern listens for `resize`. CSS `field-sizing: content` would do this without script, but is not yet in every browser.
- **Telling a pointer click from a keyboard click.** `click` events from Enter or Space have `event.detail === 0`. Modern uses this so that a mouse click on part of the summary focuses that field, while the keyboard leaves focus on the button, as a disclosure should.
- **One button with a summary inside.** The button's name is "Edit details for *task*" (action first, as `getTaskControlNames` does), and `aria-describedby` points at the summary inside it, so a screen reader hears the details after the name. The photo is hidden from assistive technology there, because the name beside it is in the text; visually hidden text gives "priority 5 of 5".
- **A sticky status needs a scrolling container.** With the window as the scroller, the sidebar and status would fight the reviewer bar's height (the first version scrolled by exactly that height). The page is now a fixed-height flex column with `.md-content` as the scroller, and the status uses `position: sticky; bottom: 20px` inside it.
- **Styled radios and checkboxes.** The chips and segments keep a real radio input stretched invisibly over the label, so clicking, the keyboard and screen readers work unchanged. Their focus ring and checked state are drawn on the label with `:has(input:focus-visible)` and `:has(input:checked)`, which needs Chrome 105, Safari 15.4 or Firefox 121 and later. The round checkbox uses `appearance: none` and an inline SVG tick.
- **Not colour alone, for chosen options.** A chosen chip has a thicker edge, a tint, bold text and a tick (`content: "\2713" / ""`, the empty alternative keeping the tick out of its name, Firefox 128 and later). A chosen priority segment is filled.
- **Dictation and focus.** As in Refined, the Settings button and the dialog carry `data-dictation-setting`, and the Settings button prevents `mousedown`, so opening Settings does not stop dictation. Opening a details panel does stop it, because the panel's controls are not titles; that matches the app, where focusing any other control stops dictation.
- **Hidden but reachable.** The grip and microphone use `opacity: 0`, not `display: none` or `visibility: hidden`, so the microphone stays in the tab order, and `:focus-within` on the row brings both back as soon as anything in the row has focus.
- **Lint: `react-hooks/purity`.** `Date.now()` for a new task's id, inside an event handler, was flagged as an impure call during render in this file, although the same line passes in `RefinedApp.tsx`. A counter in a ref replaced it. The rule's analysis seems to depend on how the handler is reached; do not assume a pattern that passes in one prototype passes in another.
- **Same sandbox limits as Refined:** no browser (below), no `ss` or `netstat` (check port 5183 with curl), and the unrelated Speechmatics adapter test failure.

## Failed approaches and lessons learned

- **Considered and rejected without building: a right-hand inspector panel** (list on the left, details of the selected task on the right). It uses wide screens well, but at 1024 px it would squeeze the titles again, which is the problem Modern is meant to solve, and it separates a task's details from its title.
- **Considered and rejected: grouping tasks by due state** (Overdue, Today, This week, ...). It is the common modern pattern and scans well, but it conflicts with the app's manual order and drag to reorder, which are established behaviour.
- **Considered and rejected: separate chips for due, priority and assignee, each opening its own popover.** Three tab stops and three popovers per row, each needing positioning, dismissal and focus return. One summary button and one panel do the same job with native elements.
- **Built and fixed before commit, found by reading the code, not in a browser:** the text area clipped wrapped titles by 2 px (border left out of the height); the page scrolled by the reviewer bar's height (sidebar sized to `100vh` below the bar); and the due column (184 px) was too narrow for "10 days remaining · 15 Nov", so it became 196 px and the short date is hidden below 1180 px.
- **Lesson:** without a browser, layout widths need working out by hand. The column widths above were checked against 1280 px and 1024 px windows on paper: titles get about 460 px and 345 px. Both need confirming on screen.

## Guidance for Distinctive

- Distinctive should be as far from Modern as Modern is from Refined. Modern is the calm, neutral, list-first option; Distinctive can be the one with character: colour, a heavier typographic voice within the system fonts, perhaps cards again but designed around the title.
- Reuse only `sampleTasks.ts` and, if useful, `simulatedDictation.ts`. Do not import Modern's or Refined's components or CSS. Copy pieces where they help, such as the level meter CSS block, the `fitToContent` idea for long titles, or the radio-on-label pattern.
- Keep the problems Robin saw in mind: titles must be readable in full, and secondary controls should not dominate. Distinctive can solve them differently from Modern; for example, keep controls on the card but group them in a quiet strip.
- Decide early whether each control is always visible, revealed, or moved, and list each as a behaviour question.
- Work widths out for 1280 px and 1024 px before building, and recheck them on screen when a browser is available.
- Follow "Making the next prototype" in `prototypes/README.md`.

## Verification

Done in the cloud sandbox:

- `npm run build` and `npm run lint` pass, and `tsc` type-checks all prototype code.
- `npm test`: 553 of 554 pass. The one failure is `src/dictation/speechmaticsAdapters.node.test.ts`, "stops a connection that is closed while still connecting", which also fails on unchanged `main` code in this sandbox (see `prototypes/README.md`).
- **Production build unchanged:** `dist/` built from this branch is byte-for-byte identical to `dist/` built from `main` (SHA-256 of every file compared), and contains no prototype code.
- No file outside `prototypes/` and `src/prototypes/` differs from `main`. The Modern code reads and writes no storage and makes no requests other than the assignee photos.
- `npm run dev:browser-check` served `/prototypes/`, `/prototypes/modern/`, `/prototypes/refined/` and every Modern module with HTTP 200, and both status endpoints reported `configured: false`. The server was then stopped and port 5183 confirmed free.
- Contrast worked out from the token values: every text pair passes 4.5:1 (lowest: green "Completed" text on a hovered row, 5.0:1, and sidebar counts on a hovered item, 5.0:1), and control edges, the checkbox ring and the focus ring pass 3:1 (lowest 3.1:1, the control edge on the sidebar). These are calculations, not measurements of the rendered page.

Not done, because no browser was permitted in the sandbox: the Playwright MCP server did not start, because the sandbox sets `PLAYWRIGHT_BROWSERS_PATH` and `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` and `server/startPlaywrightMcp.mjs` refuses to run when any `PLAYWRIGHT_*` variable is set. `AGENTS.md` forbids working around that or using another browser. So none of the following has been seen:

- How the page looks at 1280 px and 1024 px, and whether the columns line up with their labels.
- Long-title wrapping and the text area's height, including after a resize.
- Every interaction under "What to try": the panel and its focus handling, drag and drop, hover reveal, the status pill, the dialog, Escape, and focus after delete.
- Reduced motion, how the date input renders, and the photo fallback to initials.

These need a check in a local Claude Code session, where the Playwright MCP server can start, or Robin looking at the page.
