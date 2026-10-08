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
