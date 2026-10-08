# TaskManager

A browser-based task manager for creating and editing tasks, assigning users,
setting priorities and due dates, marking tasks complete, and deleting tasks.
Drag and drop tasks to reorder them. Due-date colors and pulsing overdue tasks
highlight upcoming and missed deadlines.

Tasks are saved in this browser using localStorage and restored on refresh.
The sample tasks appear on your first visit, with due dates relative to that
day. "Reset to sample tasks", beside the Assignee dropdown, replaces the current
tasks with a fresh sample set at once, without asking for confirmation. If
browser storage is unavailable, tasks remain usable in memory, but changes will
not persist.

Use the Assignee dropdown above the task list to show one user's tasks or
"All assignees". Both completed and incomplete matching tasks remain visible.
"All assignees" appears first, followed by users alphabetically by name.
Each task's assignee dropdown uses the same alphabetical user order.
Your selection is restored on refresh; a missing or unavailable assignee defaults
to "All assignees". If storage is unavailable, the selection remains usable in memory.
New tasks are assigned to the selected assignee. Under "All assignees", they
default to the first available user. Dragging filtered tasks changes their order
in the complete task list.

Dictate into a task title with the microphone button beside it, or press Ctrl
and Alt together (with no other key) while editing a title. Press either again to
stop. Recognised speech is inserted at the cursor, replacing any selected text,
with a space added where it meets existing words. Words appear as you speak and
may be corrected for a few seconds, including just after you stop. Moving the
cursor, or moving to another task title, sends further speech there. Dictation
stops automatically after a period without recognised speech (15 seconds by
default), after a maximum time (60 seconds by default, counted from when the
microphone starts recording), when focus leaves the
task titles, or when the task being dictated is deleted. Recognised text may
keep settling for up to four seconds after dictation stops. A status line above the task list reports these changes and any
problems, such as a blocked microphone. A line above the task list says "This
demo may retain dictated text for diagnostics.", because the deployed app keeps
the final recognised text; see [Stored transcripts](#stored-transcripts).
Dictation needs setting up first; see
[Set up voice dictation](#set-up-voice-dictation).

## Technologies

- React and TypeScript for the interface and application logic.
- Vite for local development and production builds.
- React DnD with the HTML5 backend for drag-and-drop reordering.
- date-fns for date calculations and formatting.
- Speechmatics realtime speech to text for dictation, using the official
  `@speechmatics/real-time-client`, `@speechmatics/browser-audio-input` and
  `@speechmatics/auth` packages.
- Vercel for hosting the deployed app and its dictation endpoints.

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

## Set up voice dictation

Dictation uses the [Speechmatics](https://docs.speechmatics.com/) realtime API.
Without this setup the app works as normal and the dictation buttons show that
dictation is unavailable.

1. Create an API key in the [Speechmatics portal](https://portal.speechmatics.com/settings/api-keys).
2. Create `.env.local` in the project directory. It is ignored by git, so the key
   is never committed:

   ```sh
   SPEECHMATICS_API_KEY=your-api-key
   ```

3. Restart `npm run dev` (or `npm run preview`) after changing `.env.local`.

The key stays on the local Vite server. The browser only receives temporary keys
that expire after 60 seconds, from `/api/dictation/token`. Locally these
endpoints are served by `npm run dev` and `npm run preview`. The deployed app
serves the same endpoints as hosted functions; see [Deployment](#deployment).

Other dictation settings live in `dictation.config.toml` in the project
directory. It is committed, so it must never contain the API key, and each
setting is explained by a comment in the file:

| Setting | Default | Purpose |
| --- | --- | --- |
| `[speechmatics] model` | `"enhanced"` | Speechmatics model, such as `"enhanced"` or `"standard"`. |
| `[speechmatics] language` | `"en"` | Language code, such as `"de"`, or a bilingual pack such as `"cmn_en"`. |
| `[speechmatics] realtime_url` | `"wss://eu.rt.speechmatics.com/v2"` | Realtime endpoint, for example the `us` or `au` region. |
| `[timings] inactivity_timeout_seconds` | `15` | Stop after this many seconds without recognised speech. Sound that produces no recognised words does not count. |
| `[timings] max_session_seconds` | `60` | Maximum length of one dictation session, from when the microphone starts recording. |
| `[timings] settle_timeout_seconds` | `4` | How long recognised text may keep settling after dictation stops. |

One timing is fixed in the code and not in the file: connecting to Speechmatics
may take up to 15 seconds from when the microphone starts recording. After that,
dictation stops and reports that the service is unavailable.

Restart `npm run dev` or `npm run preview` after changing it. The server checks
the file when it starts and stops with a message naming the problem, such as a
misspelt setting or a timing that is not a positive number.

To change the model, language or endpoint on your machine only, set
`SPEECHMATICS_MODEL`, `SPEECHMATICS_LANGUAGE` or `SPEECHMATICS_RT_URL` in
`.env.local`; these override the file.

To try multilingual dictation with the Melia 1 realtime preview, set the model
to `melia-1`, the language to `multi` and the realtime URL to
`wss://preview.rt.speechmatics.com/v2`. Speechmatics provides
the preview for evaluation only, not production use, and it does not yet support
the custom dictionary that helps recognise the app's user names.

Microphone access needs a secure context, so open the app on `localhost` or over
HTTPS. The browser asks for microphone permission the first time you dictate.
The local server must be able to reach `mp.speechmatics.com`, and the browser
must be able to reach the realtime endpoint.

## Deployment

The app is deployed on [Vercel](https://vercel.com/) as one project: the built
front end, and the dictation endpoints as Vercel Functions on the same address.
The browser connects directly to Speechmatics for realtime dictation, so the
host only issues temporary keys.

- Public address: <https://task-manager-three-phi-83.vercel.app/>
- The functions are `api/dictation/status.ts`, `api/dictation/token.ts`,
  `api/dictation/activity.ts` and `api/dictation/transcript.ts`.
  All four run the handler that local development uses, in
  `server/dictationHandler.ts`.
- Vercel reads the Speechmatics API key from the `SPEECHMATICS_API_KEY`
  environment variable in the project's settings. The key must never be
  committed to the repository or exposed in browser code. The same key can be
  used for local development and the deployment. If the key is missing, the
  deployed app remains usable but dictation is unavailable.
- The other dictation settings come from `dictation.config.toml`, which
  `vercel.json` deploys with the functions. `SPEECHMATICS_MODEL`,
  `SPEECHMATICS_LANGUAGE` and `SPEECHMATICS_RT_URL` can be set in Vercel to
  override it, as they can locally.
- Vercel compiles the functions with the options in the root `tsconfig.json`.
- Visits and page views are reported to Vercel Web Analytics, which must be
  enabled for the project in Vercel. It uses no cookies. Under `npm run dev`
  it only logs to the browser console and records nothing.
- A Neon Postgres database holds two things: dictation activity events, one
  row per event, and the complete final transcript of each dictation session,
  one row per session. The functions reach it through the `DATABASE_URL`
  environment variable, which Vercel sets when the database is connected to
  the project. See [Stored activity](#stored-activity) and
  [Stored transcripts](#stored-transcripts).
- The endpoints are public and have no access control. Usage is limited by the
  Speechmatics account's credit.

To update the deployed app, push to the branch that Vercel deploys as
production. Vercel builds and deploys it automatically. After changing an
environment variable in Vercel, redeploy for it to take effect. Running the app
locally needs no Vercel account or tools.

### Dictation activity log

The app reports when dictation is used, so that activity on the deployed app
can be seen afterwards. The browser sends an event name and a testing label to
`/api/dictation/activity`. The server writes one line of JSON to its log and,
when deployed, saves the same three values to a database:

```json
{"type":"dictation_activity","event":"dictation_transcript_received","user":"Dad","timestamp":"2026-10-08T15:30:00.000Z"}
```

| Event | What it shows |
| --- | --- |
| `dictation_started` | The microphone was allowed and Speechmatics accepted the session. |
| `dictation_transcript_received` | Speechmatics recognised at least one word. Logged once per session. |
| `dictation_completed` | A started session ended normally: stopped by the user or by an automatic stop. |
| `dictation_failed` | A session ended with an error, before or after it started. |

Transcript text, audio, keys, tokens and error messages are never written to
the log. For activity events the server accepts only the four event names above
and a valid testing label, and ignores everything else in a request. The final
recognised text is kept separately; see [Stored transcripts](#stored-transcripts). Reporting is best-effort: if it fails,
dictation carries on and nothing is retried.

To see the log, open the project in Vercel, choose Logs, and search for
`dictation_activity`. The Hobby plan keeps runtime logs for one hour, so the
log shows recent activity only. The database is the lasting record.

#### Stored activity

The deployed app saves each event to a [Neon](https://neon.com/) Postgres
database, added to the Vercel project through Vercel's Storage tab. Vercel
gives the functions its connection string as the `DATABASE_URL` environment
variable. That string is a secret: it stays on the server, and must never be
committed or used in browser code.

Each activity row holds only the event name, the testing label and the time
the server received it. No audio, key, token, IP address, user-agent or error
message is stored anywhere.

One-time setup, after creating the database and connecting it to the project:

1. In Vercel, open the Storage tab, select the database, and open it in Neon.
2. In Neon's SQL Editor, paste the contents of `server/dictationActivity.sql`
   and run it. It creates the `dictation_activity` table, and is safe to run
   again. The app never creates the table itself.
3. Redeploy the project so that the functions pick up `DATABASE_URL`.

To inspect stored activity, use Neon's Tables view, or run a query in its SQL
Editor:

```sql
-- The most recent events.
select occurred_at, user_label, event
from dictation_activity
order by occurred_at desc
limit 100;

-- Events per day, per label.
select occurred_at::date as day, user_label, event, count(*)
from dictation_activity
group by 1, 2, 3
order by 1 desc, 2, 3;
```

Things to know:

- Saving is best-effort. If the database is unreachable, slow, or its table is
  missing, the event is still written to the log, a line with the type
  `dictation_activity_store_failed` and at most a database error code is
  logged, and dictation is unaffected. `42P01` there means the table has not
  been created.
- At most 1,000 rows are stored in any 24 hours. Events beyond that are logged
  but not stored. This limits what a flood of requests to the public endpoint
  can add.
- The endpoint is public, so anyone can send a valid event with any valid
  label. Stored activity is an indication of use, not proof of it.
- Testing labels are names you choose, kept with the times they were used
  until you delete them. To remove old rows, run for example
  `delete from dictation_activity where occurred_at < now() - interval '90 days';`
- Without `DATABASE_URL`, as when running locally, events are only logged and
  no database connection is attempted. `npm run dev` and `npm run preview`
  never store events.

#### Stored transcripts

The deployed app also keeps the words that Speechmatics recognised, so that you
can see what a demonstration session produced. The app tells its users so, with
the line "This demo may retain dictated text for diagnostics." above the task
list.

- One transcript is kept for each dictation session. The browser gathers the
  session's final results in the order they arrive and joins them as the app
  does when it displays them.
- Interim results, which change as someone speaks, are never part of it, and
  audio is never sent to the server.
- The transcript is sent once, when the session has settled: after dictation
  has stopped and the settling period for late final results is over. A
  session that failed or was stopped early still sends the final results it
  had. A session with no final results sends nothing.
- It is sent to `/api/dictation/transcript` with the text in the request body,
  so that it does not appear in request logs, and saved as one row in the
  `dictation_session_transcripts` table of the same Neon database.
- A row holds the text, the testing label, the time the server received it,
  and a random identifier for the dictation session. The identifier is made
  afresh for each session and is not stored in the browser, so it does not
  identify a visitor.
- The text is never written to the server log or the browser console. The
  server logs one line per transcript with its label, session and length.
- A session is stored once: a repeated request for a session that already has
  a transcript changes nothing.
- What is kept is what Speechmatics recognised, not the title as later edited.

One-time setup: in Neon's SQL Editor, run the contents of
`server/dictationTranscripts.sql`. It adds the `dictation_session_transcripts`
table and is safe to run again. It changes nothing that exists, so the
`dictation_activity` table and any rows in `dictation_transcripts` are left
as they are. Until it has been run, transcripts are not stored, the log shows
`dictation_activity_store_failed` with code `42P01`, and dictation is
unaffected.

To read stored transcripts:

```sql
-- Complete transcripts, most recent first.
select occurred_at, user_label, transcript
from dictation_session_transcripts
order by occurred_at desc
limit 50;
```

An earlier version of the app stored each final result as its own row in
`dictation_transcripts`. Nothing writes to that table now. To read what it
holds, joined up by session:

```sql
select min(occurred_at) as started, user_label,
       string_agg(transcript, ' ' order by sequence) as said
from dictation_transcripts
group by session_id, user_label
order by started desc;
```

Things to know:

- This is other people's speech. It can contain names or anything else a
  visitor chose to say, held in a third-party database until you delete it.
  Keep it only as long as it is useful, for example
  `delete from dictation_session_transcripts where occurred_at < now() - interval '30 days';`
- A transcript is cut to 4,000 characters, several times what a 60-second
  session produces, and at most 1,000 are stored in any 24 hours.
- If the page is closed before the session has settled, which takes up to four
  seconds after dictation stops, that session's transcript is not sent.
- The endpoint is public, so anyone can send text to it under any valid label.
  Stored text is not proof that it was spoken into the app.
- Saving is best-effort, as for activity: a failure is logged without the text
  and never affects dictation.
- Without `DATABASE_URL`, and under `npm run dev` and `npm run preview`,
  transcripts are discarded unread.

#### Testing labels

A testing label names the browser that dictation was used from, so that your
own testing, and that of people you ask to try the app, can be told apart from
other visits. It is stored in that browser only, and has no control in the app.

- Set a label: open the app with `?user=NAME` added to the address, for example
  `https://your-address/?user=Robin`. It stays set for later visits without
  the parameter. Opening the app with a different name replaces it.
- Clear the label: open the app with `?user=PUBLIC`.
- Check it: in the browser console,
  `localStorage.getItem("taskmanager.activityUser")` shows the label, or `null`
  when none is set.

A label is 1 to 20 letters, digits, hyphens or underscores. Anything else is
ignored and leaves the current label as it was.

A label in the address applies to that page straight away and takes precedence
over a stored one. It does not depend on the browser being able to save it. If
the browser cannot save it, as in some private browsing modes and browsers
embedded in other apps, the label lasts only for pages opened with it in the
address, so use the full `?user=` link each time on such a browser.

Events from a labelled browser are logged with that label as `user`. All
others are logged with `"user":"PUBLIC"`, which means only that no label was
set in that browser. It does not confirm an unknown visitor: your own phone, a
private window, or any browser where you have not set a label all count as
PUBLIC. A label is a convenience and not proof of who someone is, because
anyone can open the app with any label. Giving someone a link that includes
`?user=` labels their dictation activity with that name.

### Before a demonstration

1. Open the public address in a fresh browser window that is not signed in to
   anything, and confirm it loads without a sign-in prompt.
2. Dictate into a task title and confirm the words appear as you speak.
3. Stop dictation, start it again, then refresh the page and confirm the text
   is still there.
4. Check the remaining credit in the
   [Speechmatics portal](https://portal.speechmatics.com/).
5. Confirm in Vercel that the production deployment is the intended commit.

## Available npm commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run dev:browser-check` | Start the isolated server that browser checks run against. |
| `npm run build` | Check TypeScript and create a production build in `dist/`. |
| `npm run lint` | Check the code with ESLint. |
| `npm test` | Run the unit tests once. |
| `npm run test:watch` | Rerun the unit tests as files change. |
| `npm run preview` | Serve the production build locally; run `npm run build` first. |

## Browser checks with Claude Code

Claude Code can open the app in a real browser, use it, and report what it saw.
It does this through the
[Playwright MCP server](https://github.com/microsoft/playwright-mcp), which is
registered for this project in `.mcp.json`. Nothing is added to `package.json`:
the server is fetched by `npx` the first time it is used, and `npm install`,
`npm run dev`, `npm run build`, `npm run lint` and `npm test` work the same
without it. `AGENTS.md` says when Claude runs browser checks and the rules it
follows.

### What the setup consists of

- `.mcp.json` starts `@playwright/mcp` at exactly version 0.0.83. It drives the
  Google Chrome installed on this computer, in a visible window, with these
  options:
  - `--isolated` keeps the browser profile in memory, so it starts empty, is
    discarded when the browser closes, and never touches your own profile.
  - `--allowed-origins http://127.0.0.1:5183` limits the browser's requests to
    the browser-check server. Playwright MCP documents this as a guardrail and
    not a security boundary, and it does not apply to redirects.
  - `--block-service-workers` stops a page from installing a service worker.
  - `--output-dir .playwright-mcp` is where screenshots and other files go.
    Git ignores that folder.
- It is not given the options that would connect to a browser that is already
  running (`--cdp-endpoint`, `--extension`) or that would allow files outside
  the project to be read (`--allow-unrestricted-file-access`).
- `.claude/settings.json` denies the `browser_run_code_unsafe` tool, which
  Playwright MCP describes as equivalent to running arbitrary code on this
  computer.
- `npm run dev:browser-check` starts a separate server for the checks, using
  `vite.browser-check.config.ts`, at `http://127.0.0.1:5183`:
  - It loads no `.env` files, so it never reads the Speechmatics key in
    `.env.local`. Dictation shows as unavailable.
  - It refuses to start if the shell has a Speechmatics, database or Vercel
    variable set, and names the variable without showing its value.
  - It fails if port 5183 is taken, instead of moving to another port.
  - It has its own address, so its saved tasks are separate from those of
    `npm run dev`, which can stay running.
  - It keeps its Vite dependency cache in `node_modules/.vite-browser-check`,
    separate from the `node_modules/.vite` cache that `npm run dev` uses, so
    neither server rebuilds a cache the other is serving from.
  - Like `npm run dev`, it never connects to the database.

The version was checked against the npm registry on 2026-10-08, when 0.0.83 was
the latest release. Each release depends on a pre-release build of Playwright,
which is how Microsoft publishes it. There is no stable alternative, so the
version is fixed here instead of following the newest release.

### Set it up

1. Install [Google Chrome](https://www.google.com/chrome/) if it is not already
   installed.
2. Start a new Claude Code conversation in this project. Claude Code reads
   `.mcp.json` when a conversation starts and asks you to approve the
   `playwright` server the first time.
3. Type `/mcp` and check that `playwright` shows as connected. The first start
   downloads the package, so it can take a little while.

### Check that it is working

Ask Claude to run a browser check of the app. It should start the browser-check
server, open `http://127.0.0.1:5183` in a new Chrome window that has none of
your bookmarks or sign-ins, and describe a screenshot of the task list.

While that address is restricted, two things the page normally fetches from
elsewhere are blocked: the assignee photos and the Vercel Web Analytics debug
script. Missing photos and console messages about those two requests are
expected during a browser check.

### Remove it

1. Delete `.mcp.json`, `.claude/settings.json`, `vite.browser-check.config.ts`,
   `server/browserCheckEnvironment.ts` and its test, the `dev:browser-check`
   script in `package.json`, and the `vite.browser-check.config.ts` entry in
   `tsconfig.node.json`.
2. Delete the `.playwright-mcp` folder if it exists.
3. To remove the downloaded package, delete its folder from the `npx` cache,
   which is under `%LOCALAPPDATA%\npm-cache\_npx` on Windows.

To switch it off without removing it, reject the `playwright` server when
Claude Code asks, or run `claude mcp reset-project-choices` to be asked again.

### Codex

Codex does not read `.mcp.json`. It takes MCP servers from `~/.codex/config.toml`
or from a project `.codex/config.toml`, so it would need an equivalent entry
there. That has not been set up.

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
