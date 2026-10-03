# TaskManager

A browser-based task manager for creating and editing tasks, assigning users,
setting priorities and due dates, marking tasks complete, and deleting tasks.
Drag and drop tasks to reorder them. Due-date colors and pulsing overdue tasks
highlight upcoming and missed deadlines.

Tasks are saved in this browser using localStorage and restored on refresh.
The sample tasks appear on your first visit. If browser storage is unavailable,
tasks remain usable in memory, but changes will not persist.

Use the Assignee dropdown above the task list to show one user's tasks or
"All assignees". Both completed and incomplete matching tasks remain visible.
"All assignees" appears first, followed by users alphabetically by name.
Each task's assignee dropdown uses the same alphabetical user order.
Your selection is restored on refresh; a missing or unavailable assignee defaults
to "All assignees". If storage is unavailable, the selection remains usable in memory.
New tasks are assigned to the selected assignee. Under "All assignees", they
default to the first available user. Dragging filtered tasks changes their order
in the complete task list.

## Technologies

- React and TypeScript for the interface and application logic.
- Vite for local development and production builds.
- React DnD with the HTML5 backend for drag-and-drop reordering.
- date-fns for date calculations and formatting.

## Install dependencies

With Node.js 20.19+ (20.x), 22.13+ (22.x), or 24+, and npm installed,
run this from the project directory:

```sh
npm install
```

## Run locally

```sh
npm run dev
```

Open the local URL printed in the terminal.

## Available npm commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run build` | Check TypeScript and create a production build in `dist/`. |
| `npm run lint` | Check the code with ESLint. |
| `npm test` | Run the unit tests once. |
| `npm run test:watch` | Rerun the unit tests as files change. |
| `npm run preview` | Serve the production build locally; run `npm run build` first. |

## Codex validation permissions

`.codex/rules/validation.rules` allows `npm test`, `npm run lint`, and
`npm run build` to run outside the sandbox without repeated approval prompts.
Keep workspace-write sandbox protection and on-request approvals enabled; other
commands needing execution outside the sandbox still require approval.
Trust this project in Codex and restart Codex after adding or changing the rules.

The allowances apply to TaskManager project sessions, not unrelated project
sessions. They match command prefixes, including trailing arguments, and do not
restrict the working directory of each matching command. They trust the project
scripts and their subprocesses. Remove the rules and restart Codex to revoke
these allowances; avoid saving them as user-global permissions.
