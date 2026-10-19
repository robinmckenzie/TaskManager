# TaskManager

A browser-based task manager for creating and editing tasks, assigning users,
setting priorities and due dates, marking tasks complete, and deleting tasks.
Drag and drop tasks to reorder them. Due-date colors highlight upcoming and
missed deadlines, and overdue tasks have a pastel pink background. If your
device is set to reduce motion, overdue tasks are also marked with a red
border. A task
whose due date is cleared shows "No due date" in the normal colour. Deadlines
follow the current date while the page stays open, with no need to reload.

Tasks are saved in this browser using localStorage and restored on refresh.
The sample tasks appear on your first visit, with due dates relative to that
day. "Reset to sample tasks", below the task list, replaces the current
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
keep settling for up to four seconds after dictation stops. A line at the top
of the page says how to start and stop dictating.

A status box above the task list shows what dictation is doing:

- "Connecting" from when you start until recognition is ready.
- "Listening" while speech is accepted, with a level meter beside it.
- "Finishing" once recording has stopped, while recognised text may still
  arrive. The microphone is no longer recording.
- Afterwards, why dictation stopped, or what went wrong, such as a blocked
  microphone.

The level meter shows how loud the sound reaching the microphone is. It does
not show whether speech was recognised, and a quiet meter is not an error.
"Level meter", above the task list, chooses its style, and can be
changed while dictating: "Horizontal bar" grows from the left, with a marker
that holds the recent peak for about a second, "Analogue needle" sweeps a
needle across an arc, and "Waveform" draws a row of thin vertical bars. "Look",
on the line below, offers three looks for the style that is selected: Solid,
Segments and Gradient for the bar, Classic, Zones and Ticks for the needle, and
Pill, Pulse and Columns for the waveform. Pill and Columns scroll the last
second or so of sound from right to left, Pill as white bars in a black pill
and Columns as coloured bars rising from the bottom. In Pulse the bars stay in
place and swell together. Each style keeps its own look. The choices last
until the page is reloaded. The level is
worked out in the browser from the audio already being captured, and is not
stored or sent anywhere. With reduced motion set on the device, the meter moves
in a few steps a second.

A line above the task list says "This
demo may retain dictated text for diagnostics.", because the deployed app keeps
the final recognised text; see [Stored transcripts](#stored-transcripts).
Dictation needs setting up first; see
[Set up voice dictation](#set-up-voice-dictation).

You can sign in with a Google account, which is optional. Signed in, the page
shows who you are and keeps a preferred name for you, but your tasks stay in
this browser as before. See [Sign-in with Google](#sign-in-with-google).

## Technologies

- React and TypeScript for the interface and application logic.
- Vite for local development and production builds.
- React DnD with the HTML5 backend for drag-and-drop reordering.
- date-fns for date calculations and formatting.
- Speechmatics realtime speech to text for dictation, using the official
  `@speechmatics/real-time-client`, `@speechmatics/browser-audio-input` and
  `@speechmatics/auth` packages.
- Better Auth for Google sign-in, with its accounts in Neon Postgres.
- Vercel for hosting the deployed app, its dictation endpoints and sign-in.

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

Open the local URL printed in the terminal. Sign-in shows as unavailable until
it is set up; see [Sign-in with Google](#sign-in-with-google).

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
- The dictation endpoints are public and have no access control. Usage is
  limited by the Speechmatics account's credit.
- Sign-in runs as three more functions, `api/auth.ts`,
  `api/account/status.ts` and `api/account/profile.ts`, all through
  `server/accountFunction.ts`. See [Sign-in with Google](#sign-in-with-google)
  for their variables. Previews have no sign-in.

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
database, added to the Vercel project through Vercel's Storage page. Vercel
gives the functions its connection string as the `DATABASE_URL` environment
variable. That string is a secret: it stays on the server, and must never be
committed or used in browser code.

Each activity row holds only the event name, the testing label and the time
the server received it. No audio, key, token, IP address, user-agent or error
message is stored anywhere.

One-time setup, after creating the database and connecting it to the project:

1. In Vercel, open Infrastructure, then Storage, select the database, and open
   it in Neon.
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

## Sign-in with Google

Signing in is optional. It shows who is signed in and keeps one private
setting, a preferred name, on the server. Tasks are not linked to accounts:
they stay in the browser under `taskmanager.tasks` whether or not anyone is
signed in, and signing in or out leaves the tasks, the assignee filter and the
testing label as they were. Sign-in uses
[Better Auth](https://better-auth.com/), an open-source library, run in the
app's own functions, with its data in Neon Postgres. The interface says
"account", never "user", because the users in this app are the sample
assignees.

### How it works

1. "Sign in with Google", above the header, asks `/api/auth/sign-in/social`
   for Google's sign-in address and goes there. The page is left, so it
   reloads when it comes back.
2. Google returns to `/api/auth/callback/google`. Better Auth checks the
   result, finds or creates the account, and sets a session cookie. It then
   returns to the address the sign-in started from, including any `?user=`
   testing label. If sign-in fails, it returns there with `?error=`, and the
   app says that sign-in did not complete and removes the parameter.
3. While signed in, the account area says "Signed in as" with the preferred
   name once set, else the Google name. Clicking it opens a panel to change or
   clear the preferred name, says what is kept about the account, links to the
   privacy page, and signs out. The preferred name is shown only to that
   account.
4. Signing out deletes the session on the server, so the old cookie stops
   working at once. It does not sign out of Google.

The profile endpoint, `/api/account/profile`, decides whose name to read or
change only from the session cookie, and ignores any account named in the
request. Without a valid session it answers 401. Better Auth's other
endpoints, such as the one that would let the browser change the stored name,
are not served.

If sign-in is not configured, or its database does not answer, the app works
as before and the account area says "Sign-in is unavailable".
`/api/account/status` reports `{"configured": true}` or `false`, as the
dictation status does.

**Limitation.** Where browser storage is blocked, tasks and the filter
selection exist only in memory, and the reload that sign-in causes loses them.
There is no warning, which was accepted for this demo.

### What is stored

| Table | Contents |
| --- | --- |
| `auth_user` | Account ID, the Google name and email from the first sign-in, and when it was created. The photo column is always empty. |
| `auth_account` | Google's permanent ID for the account (`account_id`). The token and scope columns are always empty. |
| `auth_session` | One row per signed-in browser, deleted on sign-out. The IP address and user agent columns are always empty. |
| `auth_verification` | Short-lived state, kept for a few minutes during each sign-in. |
| `user_profile` | The preferred name, 1 to 50 characters, if one is set. |

Database hooks in `server/accountAuth.ts` empty the token, photo, IP address
and user agent fields before anything is saved. The IP address is still used
in memory to rate-limit sign-in requests. The name and email are not updated
on later sign-ins. The public page `/privacy.html` says the same for people
signing in, and Google's sign-in screen links to it. Change it if what is
stored changes.

### Where it runs

There are two separate sign-in stores, so that development never reads or
changes production's accounts:

| Where | Store | Address |
| --- | --- | --- |
| Production | the existing Neon database, `DATABASE_URL` | `BETTER_AUTH_URL` |
| `npm run dev` | the Neon project `taskmanager-local`, `AUTH_DATABASE_URL` in `.env.local` | `http://localhost:5173` |

Sign-in uses `DATABASE_URL` only when `VERCEL_ENV` is `production`. Locally
it needs `AUTH_DATABASE_URL` and, without it, reports sign-in as unavailable
rather than falling back. The Vite plugin loads only the sign-in variables from
`.env.local`, never `DATABASE_URL`.

Vercel previews have no sign-in and always report it as unavailable, whatever
variables they have. Signing in on a preview was dropped because each
preview's address changes, and Google allows only listed return addresses.

### Set it up from scratch

Never paste a secret into a chat or a ticket. Copy it straight from the
console into `.env.local` or Vercel.

1. **Google Cloud Console.** Ignore any "free trial" banner. Google sign-in
   needs no billing.
   1. Create a project, then open Google Auth Platform and choose Get started:
      an app name without the word "Google", a support email, audience
      External, and a contact email.
   2. Branding: no logo, because a logo needs verification.
   3. Data Access: only `openid`, `.../auth/userinfo.email` and
      `.../auth/userinfo.profile`.
   4. Audience: while testing, add yourself as a test user. At most 100 test
      users can ever be added, and removing one does not free a place.
   5. Clients: create an OAuth client of type Web application, with the
      authorised redirect URIs `https://<production>/api/auth/callback/google`
      and `http://localhost:5173/api/auth/callback/google`. Copy the client
      secret when it is shown.
   6. Once the privacy page is deployed, fill in Branding's home page
      (`https://<production>/`), privacy policy link
      (`https://<production>/privacy.html`) and authorised domain (the
      production host in full, because `vercel.app` is a public suffix). Then
      choose Publish app on the Audience page. With only these scopes and no
      logo, Google requires no verification.
2. **Second Neon database.** In Vercel, under Infrastructure, then Storage,
   create a Neon database `taskmanager-local`. No deployment uses it, so
   connect it to no environment, or to Development only if Vercel requires
   one. Open it in Neon and copy its connection string. Do not use a branch
   of the production database instead: a branch starts as a copy of its
   parent, accounts included.
3. **Tables.** Run `server/accountTables.sql` in the Neon SQL Editor for the
   production database and for `taskmanager-local`. It is safe to run
   again. The app never creates tables.
4. **Variables.** Make each random secret with a command that does not show
   it. In PowerShell this copies a new one to the clipboard:

   ```powershell
   $b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); -join ($b | ForEach-Object { $_.ToString('x2') }) | Set-Clipboard; Remove-Variable b
   ```

   | Variable | Production | `.env.local` |
   | --- | --- | --- |
   | `GOOGLE_CLIENT_ID` | yes | yes |
   | `GOOGLE_CLIENT_SECRET` | yes | yes |
   | `BETTER_AUTH_SECRET` | its own random value | its own random value |
   | `BETTER_AUTH_URL` | `https://<production>` | `http://localhost:5173` |
   | `AUTH_DATABASE_URL` | not set | `taskmanager-local`'s connection string |

   Set the production variables for the Production environment only. Node.js
   must be 22 or later, because the Neon connection needs a built-in
   WebSocket.
5. Redeploy, or restart `npm run dev`, after changing a variable.

Changing `BETTER_AUTH_SECRET` signs everyone out.

### Inspect and remove accounts

In the Neon SQL Editor, on the store concerned:

```sql
-- Every account, with its preferred name and number of signed-in browsers.
select u.id, u.name, u.email, u.created_at, p.preferred_name,
       (select count(*) from auth_session s where s.user_id = u.id) as sessions
from auth_user u
left join user_profile p on p.user_id = u.id
order by u.created_at;

-- Confirm that no tokens are kept. Every count should be 0.
select count(access_token), count(refresh_token), count(id_token), count(scope)
from auth_account;

-- Remove one account and everything kept about it: its sessions, its link to
-- Google and its preferred name go with it.
delete from auth_user where email = 'person@example.com';
```

The next sign-in with that Google account creates a new account.

### Costs and limits

- Google sign-in is free, with no limit on the number of accounts once the app
  is published. While in Testing, only listed test users can sign in.
- Neon's free plan includes the second project, `taskmanager-local`.
- Sign-in adds three Vercel Functions, making seven, within the Hobby plan's
  limit.
- Rate limits are counted in memory by each function instance, so they are
  approximate.

### Upgrading Better Auth

`better-auth` is pinned to an exact version. Upgrade it on its own, check the
release notes for changes to the tables, and run any new table changes in both
stores before deploying.

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

## Tickets

Tickets are issues in this project's GitHub repository, and `AGENTS.md` has the
rules for them. Outside GitHub a ticket is written with the prefix `TM`, such as
`TM #17`.

- TaskManager's tickets: https://github.com/robinmckenzie/TaskManager/issues
- All Robin's open tickets, across projects:
  https://github.com/issues?q=is%3Aissue+is%3Aopen+user%3Arobinmckenzie

Tickets were files under `tickets/` until 2026-10-11. Each of those is now the
issue numbered ten higher, with its old ID in the title: old TM-1 is `TM #11`.

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

- `.mcp.json` starts `@playwright/mcp` at exactly version 0.0.83, through the
  launcher `server/startPlaywrightMcp.mjs`:
  - Playwright MCP also takes settings from environment variables, and an
    option in `.mcp.json` only overrides the setting it names. An inherited
    variable could otherwise load saved cookies
    (`PLAYWRIGHT_MCP_STORAGE_STATE`), attach to a browser that is already
    running (`PLAYWRIGHT_MCP_CDP_ENDPOINT`), or read another configuration or
    secrets file (`PLAYWRIGHT_MCP_CONFIG`, `PLAYWRIGHT_MCP_SECRETS_FILE`),
    whatever `--isolated` says.
  - The launcher refuses to start the server if any variable beginning
    `PLAYWRIGHT_`, `PW_`, `PWTEST_`, `PWMCP_` or `PWDEBUG` is set, and names
    the variable without showing its value. This includes harmless ones such
    as `PLAYWRIGHT_BROWSERS_PATH`. If `/mcp` shows `playwright` as failed,
    start Claude Code from a shell without those variables.
- The server drives the Google Chrome installed on this computer, in a visible
  window, with these options:
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
  - It loads no `.env` files, so it never reads the Speechmatics key or the
    sign-in settings in `.env.local`. Dictation and sign-in show as
    unavailable.
  - It refuses to start if the shell has a Speechmatics, sign-in, database or
    Vercel variable set, and names the variable without showing its value.
    Sign-in variables are those beginning `BETTER_AUTH_`, `GOOGLE_`,
    `OAUTH_PROXY_` or `AUTH_`.
  - It fails if port 5183 is taken, instead of moving to another port.
  - It has its own address, so its saved tasks are separate from those of
    `npm run dev`, which can stay running.
  - It keeps its Vite dependency cache in `node_modules/.vite-browser-check`,
    separate from the `node_modules/.vite` cache that `npm run dev` uses, so
    neither server rebuilds a cache the other is serving from.
  - Like `npm run dev`, it never connects to the production database.

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

### Run a browser check

1. Check that the shell has no Speechmatics, sign-in, database, Vercel or
   Playwright variable set, by listing names only, and that nothing is listening on port
   5183.
2. Start `npm run dev:browser-check` as a process that can be stopped on its
   own. Confirm that it listens on `127.0.0.1:5183` and that both
   `GET /api/dictation/status` and `GET /api/account/status` return
   `{"configured":false}`.
3. Open `http://127.0.0.1:5183` in the browser that Playwright MCP provides,
   and use "Reset to sample tasks" before the first check.
4. When the checks are done, close the browser with the Playwright MCP close
   tool, then stop only the browser-check server. Confirm that port 5183 is
   free and that Git shows no changes.

Things to know while checking:

- **Persistence.** The browser profile is temporary and is discarded when the
  browser closes. To check that a change is saved, reload the page in the same
  browser session before closing it.
- **Drag-and-drop.** Drop on the lower half of the target task when moving a
  task down, and on the upper half when moving it up. A drop on the exact
  centre of a task does not reorder, because the app moves a task only once the
  pointer crosses the middle of the task it is over.
- **Blocked requests.** `ERR_BLOCKED_BY_CLIENT` console errors for
  `i.pravatar.cc` and `va.vercel-scripts.com` are expected, and their number
  varies as tasks are added, reassigned and reloaded. Treat any other console
  error or failed request as a finding.
- **Assignee photos.** They are blocked, so their appearance cannot be checked
  this way. Each shows as a broken image with the assignee's name.
- **Dictation.** The server has no Speechmatics key, so the dictation buttons
  are disabled. Checking that they are disabled is in scope. Live dictation
  stays a manual check.
- **Sign-in.** The server has no sign-in settings, so the account area says
  "Sign-in is unavailable". Checking that is in scope. Live sign-in stays a
  manual check, and there is no way to sign in for a browser check.
- **Dates and sliders.** Enter a due date as `yyyy-mm-dd`, whatever format the
  page displays. A priority slider can be set directly, or by clicking it and
  pressing the arrow keys.
- **Files.** Save screenshots and snapshots under `.playwright-mcp/`, with
  names that say what they show. Playwright MCP also writes a page snapshot and
  a console log there on its own. Git ignores the folder.

### Remove it

1. Delete `.mcp.json`, `.claude/settings.json`, `vite.browser-check.config.ts`,
   `server/browserCheckEnvironment.ts` and its test,
   `server/startPlaywrightMcp.mjs`, `server/playwrightMcpEnvironment.mjs` and
   its test, the `dev:browser-check` script in `package.json`, and the
   `vite.browser-check.config.ts` entry and the `allowJs` and `checkJs` options
   in `tsconfig.node.json`.
2. Delete the `.playwright-mcp` folder if it exists. Optionally delete
   `node_modules/.vite-browser-check`, the browser-check server's dependency
   cache, which is otherwise removed along with `node_modules`.
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
