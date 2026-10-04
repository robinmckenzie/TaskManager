# TM-3 — Reorder tasks from two explicit drag surfaces

## User problem

Dragging a task currently competes with selecting text and using controls within
the card. Users need convenient, discoverable areas for reordering tasks while
normal task interactions remain reliable.

## Requirements

- Permit task dragging from the full left-hand region containing the drag handle and assignee picture, including surrounding whitespace and padding.
- Permit task dragging from unused space in the existing details row beneath the title.
- Make both drag areas discoverable through a grab cursor.
- Preserve normal editing, control activation and text selection elsewhere in the card. Those interactions must not initiate task reordering.
- Keep the card's layout essentially unchanged.
- Preserve whole-card drag previews, whole-card drop targeting, existing reorder behaviour, filtered task ordering and refresh persistence.
- Keep README changes, cross-browser testing, keyboard/touch reordering and additional visual decoration outside this ticket.

## Acceptance criteria

- Dragging can start from the handle, picture, and whitespace/padding throughout the left-hand region.
- Dragging can start from exposed unused space in the details row, including gaps and trailing space.
- Both permitted regions show the grab cursor.
- Title editing/selection, priority adjustment, date editing, assignee selection, completion and deletion work without initiating task reordering.
- Displayed text remains selectable without initiating task reordering.
- Gestures starting on protected content do not become task drags when the pointer moves into a permitted region.
- Areas outside the two permitted regions do not initiate task dragging.
- Either surface produces a whole-card preview and supports existing hover-based reordering.
- Layout remains essentially unchanged at desktop and narrow widths.
- Reordering works with filtering and survives refresh.
- Build, lint and unit tests pass, and affected behaviour is verified in the normal development browser.
