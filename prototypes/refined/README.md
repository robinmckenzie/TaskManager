# Prototype 1: Refined

The first TM #56 concept: the current TaskManager, polished. It keeps the app's layout, its blue accent, its card list and every control in the same place, and works on typography, spacing, colour, hierarchy, state and focus.

**Status:** built, not yet seen in a browser. See [Verification](#verification).

**View it:** run `npm run dev` and open <http://localhost:5173/prototypes/refined/>.

## What to try

- Edit a title. It reads as text until you hover it, then shows an edge, and a blue ring when focused.
- Change a due date and watch the state pill and the edge change. Clear a date for "No due date".
- Drag a priority slider, change an assignee, tick Complete, and Delete a task.
- Drag a task by its handle or photo.
- Press Tab through a card: every control shows the same blue focus ring.
- Click a microphone button: "Connecting", then "Listening" with the level meter, then click again for "Finishing" and "Dictation stopped." Moving focus out of the titles stops it, as in the app.
- Click **Settings** in the header to choose the level meter, with a live preview.
- Use the dark reviewer bar at the top to make dictation "Not configured", or to put the meter choice back above the list for comparison.
- "Add Task", the Assignee filter and "Reset to sample tasks" work, in memory only.

Not simulated: the Ctrl + Alt shortcut, inserting dictated text, persistence, sign-in (the button does nothing) and the account panel.

## Approach

Introduce a small set of design tokens (CSS custom properties) and apply them consistently, without changing the structure of the page.

- **Tokens.** Neutrals, the app's blue accent, a danger red, four state palettes (edge, pill background, pill text), a type scale of 12, 13, 15, 17 and 28 px, spacing on a 4 px grid, three radii and two shadows. All are at the top of `src/prototypes/refined/refined.css`.
- **Type.** The system font stack (`system-ui` first), with Inter removed since it was never loaded. Body text is 15 px. Titles are 17 px semibold. Metadata is 12 to 13 px in a darker grey than now.
- **Due state.** Instead of tinting the whole card, each card has a 5 px coloured edge on its left and a pill beside the due date, with the app's wording: "2 days overdue", "Due today", "1 day remaining", "3 days remaining", "10 days remaining", "No due date", "Completed". Each state also has its own shape, so colour is never the only signal: a warning triangle for overdue, a clock for due soon, a calendar for this week, a plain filled pill for due later, a dashed outline for no due date, and a tick for completed. Overdue cards keep a very faint pink, a nod to the app's pink. Completed cards get a faint green, a green edge and a muted title, instead of 75% opacity, which dimmed the controls too.
- **Hierarchy.** The title is the strongest element on the card. The details line and controls are quieter, with consistent heights (34 px), radii and borders. The priority number is bold, so it can be scanned.
- **Controls.** The same controls in the same order. The selects keep their native menus but get a quieter arrow. Slider, checkbox and radio take the accent through `accent-color`. Delete is still a visible text button, now in a darker red with a bin icon and a soft red hover.
- **Focus.** One 2 px blue ring, offset 2 px, on everything. The title input shows a focus border and a soft halo instead of only a bottom border.
- **Header.** The heading is a little smaller (28 px instead of 32 px) with a tighter line height. The task count is muted. "Add Task" gets a plus icon instead of "+" in its text. The dictation hint shows the microphone as a small round button and Ctrl and Alt as keycaps.
- **Dictation.** The microphone button is 30 px. Hover shows the accent. While listening it is solid red with a slow pulsing ring, and the title being dictated into gets a red ring. Connecting has a dashed edge, finishing is grey, and unavailable is dashed and muted, with a not-allowed cursor. The status box is a rounded panel with the app's shapes for each state. Its height stays reserved, so nothing moves.
- **Meter choice in Settings.** The "Level meter" and "Look" buttons move out of the controls row into a Settings dialog, opened from a button beside Add Task. They become joined segmented buttons, still marked with a tick as well as by colour, with a live preview of the chosen meter. The controls row is left with the assignee filter, the dictation status and the retention notice.
- **Reduced motion.** All transitions and the listening pulse switch off. The meter itself already steps a few times a second, as in the app.

## Proposed behaviour changes

None of these is adopted. Each needs Robin's decision before it could reach the app.

1. **Move the level meter choice into a Settings dialog.** It is a preference that is set once and then left, and it takes the most space in the controls row. A Settings button appears in the header. The dialog keeps working while dictating (it carries `data-dictation-setting`), and adds a preview, so a style can be judged without dictating. The reviewer bar switches back to the current placement for comparison. Questions: is a dialog the right home, or a popover? Should Settings hold anything else? I found no other existing control that is a preference: the assignee filter is used often and belongs with the list, and the retention notice is a disclosure that should stay visible.
2. **Show due state with an edge and a pill instead of a full card tint.** README describes overdue tasks as having "a pastel pink background", with a red border added when reduced motion is set. In Refined the red edge is always there and the pink is much fainter. This changes documented behaviour.
3. **Completed tasks without reduced opacity.** They get a green edge, a "Completed" pill with a tick, a faint green card and a muted title. Strikethrough was not used, to keep the title easy to read and edit. Should completed tasks have it?
4. **Retention notice moves** from above the filter, on the left, to the right-hand end of the controls row, with an info icon. Its wording is unchanged.
5. **New indicators while dictating:** a red ring on the title being dictated into, and a pulsing ring on its microphone button. The "Connecting" shape changes from a hollow circle to a dashed one.
6. **Title input looks like plain text until hovered or focused.** It is always editable, as now. Is it still clear enough that a title can be edited?
7. **Icons added** to Add Task (a plus icon replaces the "+" in its text), Delete (a bin), Settings (a gear) and the retention notice (an info sign).

## Advantages

- Lowest risk. Users of the app see the same page, only clearer.
- State is easier to tell apart at a glance, and works without colour.
- Every text pair passes AA, unlike three of the app's current pairs (see `prototypes/README.md`).
- Tokens make later changes cheap. Most of it is CSS.
- The controls row loses its heaviest, least-used part.

## Trade-offs

- Still dense. Every card shows seven controls all the time, so it is a tidy-up, not a new look.
- The left edge and pill are more information to learn than the current tint, and the faint tints may disappear on poor screens.
- Settings adds a click to change the meter, and hides the meter choice from people who do not open it.
- Native slider and date inputs still look a little different in each browser.

## Implementation complexity

Low to medium.

- **CSS:** the tokens and most rules could replace `src/index.css` section by section. The level meter rules need only their colours changed.
- **Markup in `App.tsx`:** the state pill needs a span and an icon, the buttons need icons, and the hint needs `<kbd>`. The card structure, drag surfaces and accessible names stay.
- **Settings dialog:** new markup and focus handling. It would also need a decision on whether the meter choice should be saved, which it is not now ("The choices last until the page is reloaded").
- **Tests and checks:** a browser check of focus order, the dialog, and drag and drop. No change to saved data.

## Would a component library help?

No. Refined keeps native controls, and the one new piece of behaviour, the dialog, is the native `<dialog>` element, which gives focus trapping and Escape for nothing. A library would add a dependency and probably a styling system without solving anything here.

## Verification

Done in the cloud sandbox:

- `npm run build` and `npm run lint` pass. `npm test` passes except for one test that also fails on the unchanged app code (see `prototypes/README.md`).
- `src/prototypes/sampleTasks.test.ts` (13 tests) confirms the sample tasks cover every state, priority and assignee, and that `getTaskState` uses the app's thresholds.
- `dist/` contains no prototype code.
- `npm run dev:browser-check` served `/prototypes/refined/` and all its modules with HTTP 200, and both status endpoints said `configured: false`.
- Contrast ratios worked out from the token values. All text pairs pass 4.5:1, from 5.2:1 (white on the blue button) upwards, and the control edges, state edges and focus ring pass 3:1. These are calculations, not measurements of the rendered page.

Not done, because no browser was permitted in the sandbox:

- Seeing the page at all, at 1280 px or 1024 px.
- Every interaction in "What to try", including drag and drop, focus order, the dialog's focus handling, and dictation stopping when focus leaves the titles.
- Reduced motion, and how the native controls render.
- Whether the assignee photos and their initials fallback look right.

These need a browser check from a local Claude Code session, where the Playwright MCP server can start, or Robin looking at the page.
