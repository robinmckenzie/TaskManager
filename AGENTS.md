# Project instructions

## Workflow and scope

- Work against a local ticket with a stable ID such as `TM-1`.
- Changes limited to project process or housekeeping files (such as `AGENTS.md`, `FUTURE_CONSIDERATIONS.md`, or `.gitignore`) do not need a ticket when explicitly requested, provided they do not change application behaviour, setup, dependencies, or tool permissions. Explain the reason in the commit or PR.
- Store local tickets in the repository as `tickets/<ticket-id>.md`.
- A ticket may be committed and pushed while still a draft, for example as a checkpoint when stopping work. Show its status below the title as `Status: Draft` or `Status: Agreed`. Only a human can agree a ticket; tickets without a status line predate this rule and count as agreed.
- Do not begin investigation, planning, or implementation until the ticket is agreed and its agreed status is committed.
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
- Distinguish genuine constraints from implementation choices. Include a constraint, such as one imposed by an external API, security, or saved-data compatibility, in Requirements only when it is genuinely required, and leave other implementation choices to investigation and planning.
- When asked to draft a ticket, write only `tickets/<ticket-id>.md`, marked `Status: Draft`. During ticket drafting, do not modify other files or begin investigation, planning, or implementation until the ticket has been agreed.
- A draft ticket needs to be coherent enough to investigate, not to settle every implementation detail. Distinguish product decisions needed before investigation, provisional or tunable defaults, questions for investigation, and product questions that investigation exposes, which are brought back for a decision.
- When handing over a drafted or revised ticket for review, separately summarise:
    - what it leaves out of scope, whether stated explicitly or left out by omission;
    - any assumptions made while drafting;
    - any conflicts or tensions with AGENTS.md, existing behaviour, or previous tickets.

## Development commands

Use npm. Keep `package-lock.json` in sync with `package.json` when dependencies change.

- `npm install` — install dependencies.
- `npm run dev` — start the development server.
- `npm run dev:browser-check` - start the isolated server for browser checks (see Browser verification).
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

## Browser verification

Claude Code can drive a real browser through the Playwright MCP server registered in `.mcp.json`. README describes the setup.

- Use it when a change affects what the app renders or how it responds to input. It is not needed for changes that cannot affect the UI.
- Run checks only against the dedicated server started with `npm run dev:browser-check`, at `http://127.0.0.1:5183`. Do not use the usual development server, `npm run preview`, `vercel dev`, or the deployed site for them. Do not stop or restart a server the owner already has running.
- Before starting the dedicated server, confirm that the shell has no Speechmatics, database or Vercel variables set, by listing variable names only. Never print a value. The server loads no `.env` files and refuses to start if such a variable is present; do not work around a refusal.
- After it starts, confirm that `GET /api/dictation/status` reports `configured: false` before opening the browser.
- Never give browser checks production credentials, and never let them reach the production database or the Speechmatics service. Live dictation stays a manual check.
- Use only the isolated browser that the MCP server opens. Never connect to the owner's own browser or browser profile.
- Open only `http://127.0.0.1:5183`. The address allow-list in `.mcp.json` is a guardrail, not a security boundary, so do not rely on it to stop a visit elsewhere.
- Begin each check from a known state by using "Reset to sample tasks".
- Screenshots and other files belong in `.playwright-mcp/`, which Git ignores. A file name given explicitly is resolved against the project root, so start it with `.playwright-mcp/`. Do not commit these files.
- Do not use `browser_run_code_unsafe`, which runs arbitrary code outside the page. `.claude/settings.json` denies it; do not remove that rule or reach the same effect another way.
- If any part of this isolation cannot be verified, stop and report instead of continuing.
- When handing over, state which behaviours were verified in a browser, which were not, and why. Do not report something as verified if automation could not check it reliably.

## Future considerations

- Review `FUTURE_CONSIDERATIONS.md` (aka FUTCONS) when planning work that may relate to an existing consideration.
- Add observations there when they may be relevant to future work but do not yet justify a ticket.
- Do not treat future considerations as requirements or planned work; revisit them when relevant and decide whether they should become part of a ticket.
- Remove or update considerations when they are resolved, superseded, or incorporated into a ticket.
