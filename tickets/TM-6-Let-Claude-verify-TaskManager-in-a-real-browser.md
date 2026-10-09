# TM-6 - Let Claude verify TaskManager in a real browser

Status: Agreed

Priority: High (P1)

## User problem

`AGENTS.md` asks for UI changes to be verified in a browser, but Claude Code has
no browser in this project. Every visual or interactive check, such as whether a
new control appears, responds to a click, or survives a refresh, currently falls
to the project's owner, and Claude has to hand over UI changes saying they are
unverified. The owner wants Claude to be able to open the running app, look at
it, use it, and report what it actually saw, so that manual testing is reserved
for what only a person can judge.

## Requirements

### What Claude can do

- Claude Code can open the locally running TaskManager in a real browser and report on what it rendered, including capturing screenshots it can inspect.
- Claude can interact with the app as a user would: click buttons and links, type into text inputs, choose dropdown options, change other task controls, and reload the page.
- Claude can read the browser console and report errors and warnings.
- With these abilities Claude can check, at least: the initial sample tasks and their appearance, creating a task, editing a title, changing assignee, priority, due date and completion, deleting a task, the assignee filter, resetting to the sample tasks, and that changes persist across a reload.
- Each check starts from a known state, reached by using the app's "Reset to sample tasks" control.
- If something cannot be checked reliably through automation, Claude says so instead of reporting it as verified. Drag-and-drop reordering is a known candidate and is investigated, not assumed.

### Isolation and safety

- Browser checks use an isolated browser profile that starts empty and is discarded afterwards. They never read or change the owner's own browsing data, including tasks saved in their normal browser, sign-ins, cookies and history.
- Browser checks run against an isolated local instance of the app, started for the checks and separate from any development server the owner already has running.
- That instance has no production credentials: no Speechmatics API key, no database connection string, and no other secret used by the deployed app.
- Browser checks never connect to the production database and never read or write its data.
- Browser checks make no request to the Speechmatics service, from the browser or from the local server, and do not use a microphone. Live dictation remains a manual check. Checking that dictation shows as unavailable without a key is in scope.
- Before the local instance is started, Claude verifies that the environment it will actually run with is isolated as described above, taking account of both environment files and variables already set in the shell. The verification never prints a secret's value. If isolation cannot be confirmed, the instance is not started and Claude reports why.
- The browser is used only for the locally running app. Where the tooling can restrict which addresses the browser may open, it is restricted to the local app.
- Files produced by browser checks, such as screenshots, are not committed.

### Tooling and setup

- Use Playwright MCP, an existing browser automation capability, and do not build a test framework. This choice was agreed before investigation.
- Register it for the project in a committed project-level `.mcp.json`, so that the setup is the same in every checkout and worktree. This was also agreed before investigation.
- Before anything is installed or registered, check the current Playwright MCP version and its security-relevant options, including profile isolation, which browser it drives, restrictions on the addresses it may open, and where it writes files. Record what was checked and the options chosen. Use a specific version, not whichever is newest at the time it runs.
- Add other repository dependencies or configuration only if the approach genuinely needs them, and keep `npm install`, `npm run dev`, `npm run build`, `npm run lint` and `npm test` working as they do today for someone without the browser tooling.
- Any one-off setup the owner must do is small and documented, along with how to tell it is working and how to remove it.
- Browser access for Codex is welcome if the same setup provides it at no extra cost, but is not required.
- If investigation shows the approach is complicated or fragile, stop and report so the ticket can be deferred.

### Project instructions

- The project's instructions say when Claude should run browser checks, and that a handover must state which behaviours were verified in a browser, which were not, and why.

### Out of scope

- An automated browser test suite that runs in `npm test` or in continuous integration.
- Testing in several browsers.
- Visual regression comparison.
- Testing the deployed site.
- Testing live dictation or audio.
- Changes to application behaviour.

## Acceptance criteria

- In a Claude Code session, Claude opens the locally running app in a real browser and describes the rendered page from a screenshot it captured in that session.
- Claude adds a task, edits its title, changes its assignee and priority, marks it complete and deletes another task, and reports the observed result of each step.
- Claude reloads the page and reports whether the changes persisted.
- Claude reports the browser console's errors and warnings for the session, or that there were none.
- Claude uses "Reset to sample tasks" to reach the known state, and a repeated check starts from that same state.
- Tasks saved in the owner's normal browser are unchanged after Claude's checks.
- The browser checks ran in an isolated profile, and the record of the checks says how that was established.
- Before the local instance was started, Claude confirmed and reported that its effective environment held no Speechmatics API key, no database connection string and no other production credential, without revealing any value.
- The app shows dictation as unavailable during the checks, no request is made to Speechmatics, and nothing is read from or written to the production database. Claude reports the evidence for each.
- Claude reports whether drag-and-drop reordering can be checked reliably, with the evidence, and it is treated as a manual check if not.
- The Playwright MCP version and security-relevant options were checked before installation, and the version and options chosen are recorded.
- Playwright MCP is registered in a committed project-level `.mcp.json` that names a specific version.
- No file produced by the browser checks is committed.
- `npm install`, `npm run dev`, `npm run build`, `npm run lint` and `npm test` behave as before on a machine without the browser tooling.
- The setup steps, how to confirm they work, and how to remove them are documented.
- The project's instructions state when browser checks are expected and what a handover must say about them.
- A first browser check of an existing feature is carried out end to end and its report is provided when handing over.
- Whether Codex can use the same setup is recorded, without work being done solely to enable it.

## Verification record

Recorded on 2026-10-09, before TM-6 merges. This records what has been checked
and does not change the requirements or acceptance criteria above.

Every browser check ran against the isolated local server started with
`npm run dev:browser-check`, at `http://127.0.0.1:5183`, in the browser that
Playwright MCP 0.0.83 opens. Nothing was checked against the usual development
server, the deployed site, or any production service.

### How isolation was established

- Before each start, the shell held no Speechmatics, database, Postgres, Neon
  or Vercel variable, checked by name only. The server's own guard passed, and
  it loads no `.env` files.
- The server listened on `127.0.0.1:5183` only, and
  `GET /api/dictation/status` returned `{"configured":false}` before the
  browser was opened.
- The Chrome process was started by the Playwright MCP server, with a
  temporary profile folder under the user's `Temp` folder. That folder was gone
  after the browser closed. The owner's own profile was not used.
- The usual development server on port 5173 was never contacted, and the same
  process held that port before and after.
- Tasks saved in the owner's normal browser are unchanged by construction: the
  checks used a different profile and a different address. This was not
  confirmed by looking at the owner's browser.

### UI checks

Run at commit `0f04fd8`, starting from "Reset to sample tasks".

| Check | Result | What was observed |
|-------|--------|-------------------|
| A. Initial state | Pass | Five sample tasks with the expected titles, assignees, priorities, due dates and completion states, and all main controls present. |
| B. Create tasks | Pass | A new task appears last, titled "New task", assigned to Alice, priority 3/5, due today and not complete. A blank title is accepted. |
| C. Edit tasks | Pass | Title, assignee, priority and due date each updated. The slider was set both directly and by a click followed by an arrow key. |
| D. Completion and deletion | Pass | Completing showed "Completed", uncompleting restored the days remaining, and deleting reduced the count from 7 to 6. |
| E. Filtering | Pass | Filtering by Bob showed only Bob's two tasks, filtering by Aaron, who had none, showed none, and a task added while filtered took that assignee. |
| F. Persistence | Pass | After a reload, the tasks, their edited values and the selected filter were intact. |
| G. Reset | Pass | "Reset to sample tasks" restored the five sample tasks in their original order and removed the test tasks. |
| H. Drag-and-drop | Pass | Tasks reordered downward and upward, from the handle and from the wider drag surface, and the new order survived a reload. |
| I. General behaviour | Pass | No broken controls, and a clean layout at the default width. See the caveats for the narrower width. |

### Caveats and limitations

- Drag-and-drop can be checked reliably, with one rule. A drop on the exact
  centre of a card did not reorder, in two attempts out of two. Drops on the
  lower half when moving down, or the upper half when moving up, reordered in
  three attempts out of three. The app moves a task once the pointer crosses
  the middle of the card it is over, and an automated drop lands on that line.
  This is not treated as an application defect.
- The address restriction blocks the assignee photos from `i.pravatar.cc` and
  the Vercel Web Analytics debug script from `va.vercel-scripts.com`. The
  console showed 20 errors and no warnings over the session, and every error
  was `ERR_BLOCKED_BY_CLIENT` for one of those two hosts. The appearance of the
  photos could not be verified.
- Live dictation was left out on purpose, because the isolated server has no
  Speechmatics key. All "Start dictation" buttons were disabled and none was
  used.
- The evidence that nothing reached Speechmatics or the database is: the
  server reported `configured: false`; every request in the browser's list for
  the final page load went to `127.0.0.1:5183` or was one of the blocked
  requests above; and the server only connects to the database when
  `DATABASE_URL` is set, which the guard refuses. The request list covers one
  page load at a time and does not show WebSocket connections, and traffic was
  not captured outside the browser.
- At a width of 390 px in desktop Chrome the heading overlapped the "Add Task"
  button, the due status text ran past the edge of the card, and longer titles
  were cut off. On the owner's iPhone the deployed app shows only the cut-off
  titles. This is recorded in `FUTURE_CONSIDERATIONS.md` as low priority and is
  not a TM-6 failure.
- Blank task titles are accepted, which matches the code. Whether to prevent
  them is recorded in `FUTURE_CONSIDERATIONS.md`.

### Evidence

These files are in `.playwright-mcp/`, which Git ignores, so they exist only on
the computer where the checks ran:

- `stage5-A-initial-state.png` and `.yml`
- `stage5-B-two-tasks-added.png` and `.yml`
- `stage5-C-task-edited.png`
- `stage5-D-task-completed.png`
- `stage5-D-after-uncomplete-and-delete.yml`
- `stage5-E-filter-bob.png`
- `stage5-F-after-reload.png` and `.yml`
- `stage5-G-after-reset.png`
- `stage5-H-after-drag-reorder.png`
- `stage5-I-narrow-390.png`
- `stage5-I-console-all.log`
- `stage5-I-network-last-load.txt`

### Other checks

- `npm run build`, `npm run lint` and `npm test` pass at `0f04fd8`, with 361
  tests across 22 files.
- The Playwright MCP package in the `npx` cache, and the running server
  process, were both version 0.0.83, as `.mcp.json` names.
- The browser-check server kept its Vite dependency cache in
  `node_modules/.vite-browser-check` and did not change `node_modules/.vite`.
- Codex has not been given the same setup. README records what it would need.

### After the Codex review

Recorded on 2026-10-09. It adds to the record above, which is left as it was
written. The UI checks above were run before this fix and have not been
repeated since.

An independent Codex review of the branch at `4f69c71` found that Playwright
MCP 0.0.83 also takes settings from inherited environment variables, which
could undo the isolation that `.mcp.json` asks for. Reading the package's code
confirmed it:

- Settings are merged in this order: defaults, a configuration file,
  environment variables, then command-line options. A command-line option only
  overrides the setting it names.
- `PLAYWRIGHT_MCP_STORAGE_STATE` is passed into the isolated browser context,
  so it would preload cookies and localStorage.
- `PLAYWRIGHT_MCP_CDP_ENDPOINT` is checked before `--isolated`, so it would
  attach to a browser that is already running.
- `PLAYWRIGHT_MCP_CONFIG` and `PLAYWRIGHT_MCP_SECRETS_FILE` would read another
  configuration or secrets file.
- Others have similar effects, including `PLAYWRIGHT_MCP_INIT_SCRIPT`,
  `PLAYWRIGHT_MCP_INIT_PAGE`, `PLAYWRIGHT_MCP_EXTENSION`,
  `PLAYWRIGHT_MCP_EXECUTABLE_PATH`, `PLAYWRIGHT_MCP_PROXY_SERVER`,
  `PLAYWRIGHT_MCP_BLOCKED_ORIGINS`, `PLAYWRIGHT_MCP_CAPS` and
  `PLAYWRIGHT_MCP_ALLOW_UNRESTRICTED_FILE_ACCESS`, and some variables with
  other Playwright prefixes choose a profile or attach to a browser.

The fix: `.mcp.json` now starts the server through
`server/startPlaywrightMcp.mjs`, which refuses to start it when any variable
beginning `PLAYWRIGHT_`, `PW_`, `PWTEST_`, `PWMCP_` or `PWDEBUG` is set. The
check runs in the process the server inherits its environment from. The package
version and options are still named in `.mcp.json`.

Verified for the fix:

- `npm run build`, `npm run lint` and `npm test` pass, with 415 tests across
  23 files. The new tests use made-up values, cover each variable named above,
  and check that `.mcp.json` goes through the launcher.
- Run directly with made-up `PLAYWRIGHT_MCP_STORAGE_STATE` and
  `PLAYWRIGHT_MCP_CDP_ENDPOINT` values, the launcher exited with status 1
  before starting anything, named both variables, and showed neither value.
- Run directly with `--version` in place of the package, the launcher ran
  `npx`, passed its output through and returned its exit status. This checked
  how it starts a command on Windows without starting Playwright MCP.

When this was recorded, it had not yet been verified that Claude Code starts
Playwright MCP through the launcher and that the browser tools still work,
because that needs a new Claude Code conversation, which reads `.mcp.json` when
it starts. The post-fix smoke test below has since verified it.

Still a limitation of the earlier UI checks:

- They did not record whether a Playwright variable was set in the MCP
  server's environment. The shell used for the checks had none when this was
  recorded, the browser was seen to be started by the MCP server with a
  temporary profile, and the first page load showed only the sample tasks.

### Post-fix smoke test

Recorded on 2026-10-09, at commit `f8fc5b1`, in a new Claude Code conversation.
This is a short check that the setup still works through the launcher. It is
not a repeat of the UI checks A to I above, which were run once, at `0f04fd8`,
before the fix.

- The working tree was clean at `f8fc5b1` before and after, and no file was
  edited.
- The shell held no Playwright, Speechmatics, database or Vercel variable,
  checked by name only.
- The conversation's Claude Code process had started
  `node server/startPlaywrightMcp.mjs` with the arguments in `.mcp.json`, and
  that process had started `@playwright/mcp@0.0.83`. This was read from the
  process list, not from `/mcp`, which Claude cannot run.
- The `browser_run_code_unsafe` tool was not available.
- The dedicated server listened on `127.0.0.1:5183`, and
  `GET /api/dictation/status` returned `{"configured":false}` before the
  browser was opened.
- The browser tools worked: opening the page, a page snapshot, a click, a
  screenshot, and reading the console and the request list.
- The Chrome process was started by that MCP server with a temporary profile
  folder under the user's `Temp` folder. On the first page load it held no
  cookies, service workers, IndexedDB databases or session storage, and its
  localStorage held only the app's own two keys. The folder was gone after the
  browser closed.
- The five sample tasks loaded, on the first page load and again after "Reset
  to sample tasks", and the dictation buttons showed as unavailable.
- The console showed four errors and no warnings, all `ERR_BLOCKED_BY_CLIENT`
  for `i.pravatar.cc` or `va.vercel-scripts.com`. Every other request went to
  `127.0.0.1:5183` and succeeded.
- The browser was closed and the dedicated server stopped. Port 5183 was free
  afterwards, and the same process held port 5173 before and after.

Not covered by the smoke test: creating, editing, completing, deleting,
filtering, persistence across a reload, and drag-and-drop.

One other thing was seen: an older Claude Code conversation, started before
the fix was loaded, still had its own Playwright MCP server running, started
without the launcher. It belonged to that conversation only. The smoke test
used the guarded server described above and nothing else, and the older one
was left alone.

Added after the smoke test: `server/startPlaywrightMcp.test.ts` covers the
launcher's own control flow with a stand-in for the server process, so no
`npx` or browser is started. `npm run build`, `npm run lint` and `npm test`
pass, with 425 tests across 24 files.
