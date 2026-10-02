# TaskManager

A browser-based task manager for creating and editing tasks, assigning users,
setting priorities and due dates, marking tasks complete, and deleting tasks.
Drag and drop tasks to reorder them. Due-date colors and pulsing overdue tasks
highlight upcoming and missed deadlines.

Tasks are stored in memory. Refreshing the page restores the sample tasks.

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
| `npm run preview` | Serve the production build locally; run `npm run build` first. |
