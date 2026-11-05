# TaskManager visual prototypes (TM #56)

Interactive concepts for TM #56, "Improve TaskManager styling and look and feel". There are to be three: Refined, Modern and Distinctive. They are for comparison only. They are kept on an unmerged branch, and nothing here changes the app.

| Concept | Status | Page | Write-up |
| --- | --- | --- | --- |
| Refined | Built, awaiting Robin's feedback | `/prototypes/refined/` | [refined/README.md](refined/README.md) |
| Modern | Built, awaiting Robin's feedback | `/prototypes/modern/` | [modern/README.md](modern/README.md) |
| Distinctive | Built, awaiting Robin's feedback | `/prototypes/distinctive/` | [distinctive/README.md](distinctive/README.md) |

## Quick start

```sh
npm install
npm run dev
```

Then open <http://localhost:5173/prototypes/> for the list, or <http://localhost:5173/prototypes/refined/>, <http://localhost:5173/prototypes/modern/> or <http://localhost:5173/prototypes/distinctive/> directly. If 5173 is already in use, Vite takes the next free port (for example 5174) and prints it; use that instead. Any desktop browser works. The dark bar at the top of each prototype holds reviewer controls, which are not part of the design.

All three prototypes live on the unmerged branch `claude/intelligent-shannon-nlseaw`, which was made from Modern's branch. The earlier branches are kept too: `claude/relaxed-archimedes-6f4ts7` holds Refined and Modern, and `claude/cool-keller-x3xkeq` holds Refined alone. Robin has decided to keep every prototype permanently on an unmerged branch as a design archive, so do not delete these branches after a design is chosen or implemented.

For an agent's browser check, use `npm run dev:browser-check` and open <http://127.0.0.1:5183/prototypes/refined/>, <http://127.0.0.1:5183/prototypes/modern/> or <http://127.0.0.1:5183/prototypes/distinctive/>, following the browser rules in `AGENTS.md`.

## The three concepts compared

| | Refined | Modern | Distinctive ("Docket") |
| --- | --- | --- | --- |
| Structure | The app's card list, polished | Sidebar and a compact list in columns | One ruled list, full width, with a fixed editing dock below |
| Task height | About 100 px | About 44 px | About 82 px |
| Title width at 1280 px | Shared with seven controls; long titles cut off | About 460 px, wraps | About 720 px, wraps |
| Due state | Coloured edge and pill | Text and icon in a column; pill for urgent states | Countdown block leading each entry: big day count, state word, shape |
| Editing details | Controls on every card | Panel opening beneath the row | Dock at the foot of the window, for the selected task |
| Delete | On the card | In the panel | In the dock |
| Grip and microphone | Always shown | Shown on hover or focus | Always shown, quiet |
| Completion | "Complete" checkbox | Round checkbox at the start | Square box at the end |
| Assignee filter | Select above the list | Sidebar list with counts | Pills under the masthead |
| Dictation status | Panel above the list | Floating pill at the foot of the list | Lower line of the dock |
| Level meter choice | Settings dialog | Settings dialog | Panel beside the dictation status |
| Look | White, blue | White, grey sidebar, indigo | Warm paper, ink, serif masthead, yellow highlighter |

## How the prototypes are isolated

- **Not in the production build.** Vite builds only the root `index.html` unless `build.rollupOptions.input` names more entries, and `vite.config.ts` names none. The prototype pages under `prototypes/` are served only by the development servers. After `npm run build`, `dist/` holds only `index.html` and `privacy.html`, and no built file contains prototype code. This was checked on 2026-11-05 for Refined, and again after Modern and after Distinctive were added, when every file in `dist/` was byte-for-byte identical to a build of `main`. Vercel previews of this branch run the same build, so they do not include the prototypes either.
- **No saved data.** Prototypes keep tasks in React state. Nothing in `src/prototypes/` reads or writes `localStorage`, `sessionStorage` or `taskmanager.tasks`. Reloading a prototype starts again from the sample tasks.
- **No requests.** Prototypes do not call `/api/*`, use the microphone, load analytics or reach Speechmatics. Dictation is simulated (see below). The only external requests are the assignee photos from `i.pravatar.cc`, the same addresses the app uses. When they are blocked, as in a browser check, initials are shown instead.
- **App code untouched.** No file outside `prototypes/` and `src/prototypes/` was changed. Prototypes import a few pure functions and two small components from the app (listed below) but change none of them.

## Files

```
prototypes/
  index.html               List of prototypes (dev server only)
  README.md                This file
  refined/
    index.html             Entry page; loads /src/prototypes/refined/main.tsx
    README.md              Refined write-up: approach, trade-offs, behaviour questions
  modern/
    index.html             Entry page; loads /src/prototypes/modern/main.tsx
    README.md              Modern write-up and handover: rationale, files, behaviour questions, pitfalls
  distinctive/
    index.html             Entry page; loads /src/prototypes/distinctive/main.tsx
    README.md              Distinctive write-up and handover: concepts, rationale, behaviour questions, pitfalls
src/prototypes/
  sampleTasks.ts           Shared sample tasks and users, and getTaskState()
  sampleTasks.test.ts      Checks the samples cover every state, priority and assignee
  simulatedDictation.ts    Optional stand-in for dictation (phases, messages, level)
  refined/
    main.tsx               Mounts RefinedApp with refined.css; no app CSS, no analytics
    RefinedApp.tsx         The whole Refined page, in one file
    refined.css            All Refined styling: tokens, components, level meter rules
  modern/
    main.tsx               Mounts ModernApp with modern.css; no app CSS, no analytics
    ModernApp.tsx          The whole Modern page, in one file
    modern.css             All Modern styling: tokens, layout, components, level meter rules
    quickDueDates.ts       Pure helpers: quick due dates, task updates
    quickDueDates.test.ts  Unit tests for quickDueDates.ts
    TaskDetails.test.tsx   Checks the details panel's date field and quick dates agree
  distinctive/
    main.tsx               Mounts DistinctiveApp with distinctive.css; no app CSS, no analytics
    DistinctiveApp.tsx     The whole Distinctive page, in one file
    distinctive.css        All Distinctive styling: tokens, layout, components, level meter rules
    docket.ts              Pure helpers: countdown wording, short due date, quick due dates
    docket.test.ts         Unit tests for docket.ts
```

The three prototypes share nothing but `sampleTasks.ts` and `simulatedDictation.ts`. None imports another's components or styles, and none loads `src/index.css`. Keep it that way for any later concept, so that each is free to differ.

The HTML entry pages live under `prototypes/` and the TypeScript under `src/prototypes/` for a reason. `tsconfig.app.json` type-checks only `src` and `shared`, so code placed under `prototypes/` would escape `npm run build`'s type check. ESLint covers both.

## Sample tasks

`src/prototypes/sampleTasks.ts` is the one thing every prototype should share, so that the concepts are compared on the same content. It is data and logic only, with no markup or styling.

- `prototypeUsers`: the app's four assignees (Alice, Bob, Charlie, Aaron), with the same ids and photo addresses, plus initials for when a photo cannot load.
- `createPrototypeTasks(today)`: a fresh array of seven tasks in the app's `TaskType` shape. Due dates are worked out from `today`, so the states are right whatever the date.
- `getTaskState(task, today)`: returns `completed`, `overdue`, `due-soon`, `due-this-week`, `due-later` or `no-due-date`, using the same thresholds as `getBackgroundClass` in `src/App.tsx`.

| Id | Title | Assignee | Priority | Due | State |
| --- | --- | --- | --- | --- | --- |
| p-1 | Fix authentication bug | Bob | 5 | 2 days ago | overdue |
| p-2 | Prepare sprint demo | Alice | 4 | today | due soon |
| p-3 | Review dictation pull request | Charlie | 3 | tomorrow | due soon |
| p-4 | Write release notes | Aaron | 2 | in 3 days | due this week |
| p-5 | Update the onboarding documentation for contributors joining the project next month | Charlie | 3 | in 10 days | due later |
| p-6 | Plan the next quarter's roadmap | Alice | 1 | none (empty string) | no due date |
| p-7 | Deploy initial build | Bob | 5 | 3 days ago | completed |

The set covers every state, both ends of "due soon" (today and tomorrow), the "this week" boundary (3 days), every priority from 1 to 5, every assignee, a title long enough to overflow, and a completed task whose date has passed. Each prototype should show them in this order. `sampleTasks.test.ts` checks the coverage against three dates, including a month end and a year end. Do not change the set without changing it for every prototype.

A due date of `""` stands for no due date, as when a date is cleared in the app: `getDaysUntilDue("")` returns `null`. The app's own sample tasks (`createSampleTasks` in `src/tasks.ts`) have no such task and no "due soon" task, which is why the prototypes have their own set.

## Reusing the app's code

A prototype may import these. They are pure, or render plain markup, and none touches storage or the network:

| Import | From | Use |
| --- | --- | --- |
| `TaskType`, `reorderTasks` | `src/tasks.ts` | Task shape, in-memory reorder by full-list index |
| `getDaysUntilDue`, `describeDueStatus` | `src/dueDates.ts` | "2 days overdue", "Due today", "3 days remaining", "No due date", "Completed" |
| `getTaskControlNames` | `src/taskControlNames.ts` | The app's accessible names for each card control |
| `sortAssigneesByName` | `src/users.ts` | Alphabetical assignee order, as in the app's dropdowns |
| `describeDictationPhase`, `describeDictationStop`, `describeDictationError` | `src/dictation/dictationMessages.ts` | The app's dictation wording |
| `LevelMeter`, `MeterChoice` and its look types | `src/dictation/LevelMeter.tsx` | The real level meter, driven by any `readLevel()` |
| `MicrophoneIcon` | `src/dictation/MicrophoneIcon.tsx` | The app's microphone glyph |

Do not import `src/index.css`, `src/App.tsx`, `src/main.tsx` (it loads Vercel Analytics), `useDictation`, `AccountControl` or `loadTasks`. They bring in global styles, storage, network calls or the real microphone.

`src/prototypes/simulatedDictation.ts` is optional. `useSimulatedDictation(availability)` steps through the app's phases: idle, then "Connecting" for 0.8 s, then "Listening", and after a stop "Finishing" for 1.2 s, then idle with the app's stop message. It also gives the "not configured" message when unavailable, and a made-up level from the clock for the meter. A prototype may use it, copy and change it, or do without.

## The app's styling, for reference

From reading `src/index.css` and `src/App.tsx` (see also the first comment on TM #56):

- One global stylesheet, `src/index.css`, about 920 lines, with plain class names such as `.task`, `.app-header` and `.delete-button`, and global rules for `body`, `button`, `input` and `select`. Colours are hard-coded hex values. The only custom properties drive the level meter. `src/App.css` is unused.
- The Inter font is named but never loaded, so the system font is what users see.
- **The level meter's class names are fixed.** `LevelMeter` renders `.level-meter`, `.level-meter-bar-solid`, `.level-meter-wave-bar` and so on, and draws by setting `--level`, `--peak` and `--past` on those elements. A prototype that uses `LevelMeter` must style those classes itself, because the app's rules are in `index.css`. `refined.css`, `modern.css` and `distinctive.css` each end with a copy of them that takes its colours from that prototype's tokens. Copy either block as a starting point; the meter designs themselves are out of scope.
- **Dictation settings must keep focus.** In the app, dictation stops when focus leaves the task titles, except for elements inside `[data-dictation-setting]`. The meter selector carries that attribute and calls `preventDefault()` on `mousedown`, so clicking it leaves the cursor in the title. Any new home for a dictation setting (a dialog, a popover, a menu button) needs the same attribute, or opening it would stop dictation. Refined puts it on the Settings button and on the `<dialog>`.
- The app's task card has two drag surfaces: the handle and photo on the left, and the empty space in the details line. react-dnd moves a task while dragging, once the pointer crosses the middle of the task it is over.

Contrast of the app as it is now (WCAG ratios, from the colour values in `index.css`; the backgrounds are the due-state tints):

| Text | Background | Ratio | AA (4.5:1) |
| --- | --- | --- | --- |
| Details text `#666` | Overdue `#fecaca` | 3.97 | Fails |
| Delete `#dc2626` | Overdue `#fecaca` | 3.34 | Fails |
| Retention notice `#777` | Page `#f4f5f7` | 4.11 | Fails |
| Details text `#666` | Due soon `#fff3cd` | 5.18 | Passes |

The completed card's `opacity: 0.75` lowers every ratio on it further. That was not measured, because it depends on rendering.

## Discoveries, constraints and pitfalls

- **No browser check was possible in the cloud sandbox.** The Playwright MCP server failed to connect. Its launcher, `server/startPlaywrightMcp.mjs`, refuses to start when any `PLAYWRIGHT_*` variable is set, and the cloud sandbox sets `PLAYWRIGHT_BROWSERS_PATH` and `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` for its own browser. `AGENTS.md` allows only the browser that the MCP server opens, and says not to work around a refusal, so no other browser was used. A Playwright script with the sandbox's own Chromium, headless Chrome screenshots and jsdom would each break that rule or add a tool. Visual and interaction checks need either a local Claude Code session on Robin's computer, where the MCP server starts, or Robin looking for themselves.
- **What could be checked without a browser:** `npm run build`, `npm run lint`, `npm test`, the type check of all prototype code, that `dist/` has no prototype code, that `npm run dev:browser-check` serves the prototype page and all its modules (HTTP 200) with both status endpoints saying `configured: false`, and WCAG contrast ratios worked out from the token values.
- **`ss` and `netstat` are not installed** in the cloud sandbox. Check whether port 5183 is free with `curl -s --max-time 2 http://127.0.0.1:5183/`, which fails when nothing is listening.
- **A test fails before any prototype change:** `src/dictation/speechmaticsAdapters.node.test.ts`, "stops a connection that is closed while still connecting". It fails the same way on the unchanged code from `main` in the sandbox, and is about the Speechmatics WebSocket adapter, which the prototypes do not use. It may depend on the environment; it has not been investigated.
- **Native drag and drop versus text inputs.** A card with `draggable="true"` stops the mouse from selecting text in its inputs in some browsers. Refined makes the card draggable only while the pointer is down on its grip, and disarms it on any pointer release on the card. This is unverified in a browser.
- **`<dialog>` and focus.** `showModal()` traps focus and closes on Escape with no extra code. Focus then has to be sent back by hand: Refined sends it to the title being dictated into, if any, or else to the Settings button. A click on the backdrop lands on the `<dialog>` element itself, which is how Refined closes on a backdrop click (the dialog has no padding of its own, so a click inside never targets it).
- **Native controls.** A `<select>` can be fully restyled with `appearance: none` and a background-image arrow. Range inputs, checkboxes and radios take `accent-color` reliably, but more styling than that needs per-browser pseudo-elements. Refined stops at `accent-color`. Date inputs differ between browsers and are only bordered.
- **Contrast of non-text edges.** WCAG 1.4.11 asks for 3:1 on control boundaries. The app's `#ccc` borders give about 1.6:1. Refined's first choice, `#8c95a1`, passed on white but not on the page background (2.78:1), so it became `#7d8794`. The first "this week" edge colour `#ca8a04` was 2.94:1 and became `#a16207`.
- **Focus ring on the blue button.** The ring colour `#1d4ed8` against the button's `#2563eb` is only 1.3:1. The ring is offset by 2 px, so it is seen against the page (6.1:1) instead. Keep the offset if the ring colour stays close to the accent.
- **Modern's own discoveries** are in [modern/README.md](modern/README.md#technical-discoveries-and-pitfalls). The ones most likely to matter for Distinctive: sizing a text area to a long title must add the border to `scrollHeight`; `event.detail === 0` tells a keyboard click from a pointer click; a sticky element needs a scrolling container of known height; and `react-hooks/purity` flagged `Date.now()` in an event handler in `ModernApp.tsx` but not in `RefinedApp.tsx`, so use a counter for new ids.
- **Distinctive's own discoveries** are in [distinctive/README.md](distinctive/README.md#technical-discoveries-and-pitfalls). The ones most likely to matter later: `react-hooks/refs` rejects reading a ref's `.current` in JSX even to pass it to a helper; deriving the selection from an id (falling back to the first visible task) avoids effects that repair it; and a dock placed as the last item of a 100vh flex column ends the scroll area instead of covering the list, as a fixed one would.
- **Tick marks in toggle buttons.** The meter buttons draw their tick with `content: "\2713\00a0" / ""`, the empty alternative text keeping it out of the accessible name, as the app does. Firefox has supported that syntax only since version 128.

## Approaches tried that did not work

- **Browser verification through Playwright MCP:** refused in the cloud sandbox, as described above. No workaround was attempted.
- **Two of the first colours** failed the 3:1 non-text contrast check and were replaced (above).
- **An early port check** used `ss`, then `netstat`, and printed "port 5183 free" when both commands were missing. It proved nothing; the curl check above replaced it.
- **Modern:** a right-hand inspector panel, grouping tasks by due state, and a popover per detail were each considered and rejected, and three layout bugs were found by reading the code before commit. See [modern/README.md](modern/README.md#failed-approaches-and-lessons-learned).
- **Distinctive:** people lanes (a board per assignee) and a deadline horizon (a timeline) were considered and rejected, and a fortnight strip, a Settings dialog and a second home for the dictation hint were dropped during design. See [distinctive/README.md](distinctive/README.md#failed-approaches-and-lessons-learned).
- **Considered and rejected without building:** loading the app's `index.css` and overriding it. Its global selectors (`body`, `button`, `.task`) and specificity would leak into the prototype, and later concepts would have been judged partly against leftover styles. Each prototype has a standalone stylesheet instead.

## Making the next prototype

1. Work on the same unmerged prototype branch, or a branch made from it, so that every concept stays reachable from `/prototypes/`.
2. Create `prototypes/<name>/index.html` by copying `prototypes/refined/index.html` and changing the title and the script path to `/src/prototypes/<name>/main.tsx`.
3. Create `src/prototypes/<name>/main.tsx`, which mounts your page and imports your own stylesheet. Import no app stylesheet.
4. Build the page from `createPrototypeTasks()` and `prototypeUsers`, in the given order. Use `getTaskState()` for the due state, and `describeDueStatus()` for the wording, unless the concept proposes different wording (then list that as a behaviour question).
5. Use whatever markup, layout, class prefix and interaction patterns suit the concept. Nothing in Refined has to be reused: not its components, its tokens, its card layout, its Settings dialog or its reviewer bar. Copy whatever helps and ignore the rest.
6. If you use `LevelMeter`, style the `.level-meter*` classes in your stylesheet (copy the block at the end of `refined.css`). If you move a dictation setting, keep `data-dictation-setting` on it and on whatever opens it.
7. Cover the ticket's list for each concept: header, controls row, task cards and their controls, every state, title editing, due date, priority, assignee, complete, hover, keyboard focus, the drag affordance, the dictation hint, retention notice, status box and meter choice. Meet the baseline: AA text contrast, visible focus, state not by colour alone, reduced motion respected.
8. Add a link in `prototypes/index.html` and a row in the table at the top of this file, and write `prototypes/<name>/README.md` with the approach, advantages, trade-offs, implementation complexity, whether a component library would help, behaviour questions, and what was verified.
9. Run `npm run build`, `npm run lint` and `npm test`, and confirm that `dist/` still has only `index.html` and `privacy.html`. A stronger check, used for Modern: build `main` and the branch, and compare SHA-256 hashes of every file in `dist/`.
10. Work out the layout's widths at 1280 px and 1024 px before building, since a browser may not be available to see them. Modern's write-up has a section of guidance for Distinctive.

## Open questions for Robin

These concern all three concepts. Each concept's own questions are in its write-up.

- Should the reviewer controls look the same in every prototype, so they are easy to tell apart from the design? All three use a dark bar across the top.
- The ticket's default is to check each prototype at about 1280 px and one narrower desktop width. All three layouts are written for 1280 px and 1024 px, but none has been seen in a browser yet. Is that still the range wanted?
- When the concepts are compared, should they be seen one at a time, or would a page showing them side by side help?
