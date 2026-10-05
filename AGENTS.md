# Project instructions

## Workflow and scope

- Work against a local ticket with a stable ID such as `TM-1`.
- Store local tickets in the repository as `tickets/<ticket-id>.md`.
- Once a ticket has been agreed and reviewed, commit it before beginning investigation or planning.
- If investigation or planning leads to an agreed change in requirements, update the relevant ticket to reflect that decision before implementing it.
- Scope changes to the ticket. Avoid unrelated refactors, formatting changes, cleanup, or dependency upgrades.
- Reference the relevant ticket ID in commits.
- Summarize the resulting behavior, validation performed, and any remaining limitations when handing off changes.
- Update README when setup, commands, or documented user behavior change.

## Ticket writing

- Use these sections in order:
    1. User problem — why are we doing this?
    2. Requirements — what behaviour do we want?
    3. Acceptance criteria — how will we know we've achieved it?
- Describe the problem and required behaviour without unnecessarily prescribing implementation details.

## Development commands

Use npm. Keep `package-lock.json` in sync with `package.json` when dependencies change.

- `npm install` — install dependencies.
- `npm run dev` — start the development server.
- `npm run build` — check TypeScript and create the production build.
- `npm run lint` — run ESLint.
- `npm test` — run unit tests once.
- `npm run test:watch` — run tests in watch mode.
- `npm run preview` — serve the production build after building.

See README for supported Node.js versions.

## Code conventions

- Use the existing React, TypeScript, and Vite stack.
- Follow nearby formatting and the existing TypeScript and ESLint configurations.
- Prefer function names that are verbs or start with verbs and describe what the
  function does rather than how it does it. Make intent clear at the call site
  so readers usually do not need to inspect the implementation. Follow established
  conventions where clearer, such as React hooks starting with `use` and predicates
  starting with `is`, `has`, or `can`.
- Keep React state updates immutable.
- Keep non-UI logic separately testable where useful. Colocate unit tests as `*.test.ts`.
- Application styling is in `src/index.css`.
- Respect LF line endings configured by `.gitattributes`. Do not commit generated build output or local artifacts.

## Writing conventions

- Use hyphens (`-`) instead of em dashes in prose, documentation, and comments.

## Persistence

- Preserve compatibility with existing data stored under `taskmanager.tasks`. Changes to the storage key or schema must account for saved data.
- Preserve task order, saved empty lists, and usable in-memory behavior when browser storage is unavailable unless the ticket explicitly changes these behaviors.

## Validation

- For code changes, run `npm run build`, `npm run lint`, and `npm test`. Report failures or checks that could not run.
- Add or update regression tests for changed logic where useful.
- For UI changes, verify affected behavior in a browser. Check drag-and-drop and refresh persistence when those features are affected.

## Future considerations

- Review `FUTURE_CONSIDERATIONS.md` (aka FUTCONS) when planning work that may relate to an existing consideration.
- Add observations there when they may be relevant to future work but do not yet justify a ticket.
- Do not treat future considerations as requirements or planned work; revisit them when relevant and decide whether they should become part of a ticket.
- Remove or update considerations when they are resolved, superseded, or incorporated into a ticket.
