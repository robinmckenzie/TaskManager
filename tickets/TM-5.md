# TM-5 - Deploy TaskManager with live Speechmatics dictation

Status: Agreed

## User problem

TaskManager, including the voice dictation added in TM-4, only runs on a
developer's machine. Its owner wants to demonstrate it in an interview by giving
the interviewers a public web address to open on their own computers, without
the owner's laptop being available. The demonstration is only worthwhile if
dictation genuinely works there. The dictation endpoints currently exist only
inside Vite's development and preview servers, so a build of the app has no way
to obtain Speechmatics credentials.

## Requirements

- TaskManager is available at a public HTTPS address and works entirely through it. Opening it needs no installation, development server, account, sign-in or special configuration, and the deployment does not rely on a local fallback.
- Dictation on the deployed app is live Speechmatics realtime dictation, behaving as TM-4 specifies. A static, recorded or simulated demonstration does not meet this ticket.
- Apart from where it is served from, the deployed app behaves as the local app does. Task data continues to be stored only in the visitor's browser.
- A visitor with no saved tasks sees sample tasks whose due dates are relative to their current local calendar date, so that the demonstration looks current whenever it is opened: a completed "Deploy initial build" due 2 days ago, shown first with the completed styling, then "Design UI" due yesterday, "Fix authentication bug" in 2 days, "Write documentation" in 10 days and "Deploy to production" in 21 days. The dates are worked out when the sample tasks are created, not at build time, and do not depend on the time of day. Other sample task properties, the overdue styling and animations, and existing saved data are unchanged.
- A "Reset to sample tasks" control near the task list controls immediately replaces the current tasks with a fresh sample set dated from today, with no confirmation and no page reload. The replacement is saved as other task changes are, and the assignee filter is unchanged. The control is a keyboard-accessible button styled as an unobtrusive text link. No other reset options are added.
- A task's due label counts local calendar days between today and its due date, not complete 24-hour periods, so it reads the same throughout the day: a task due yesterday is "1 day overdue", one due today is "Due today", and one due tomorrow is "1 day remaining". The existing overdue and due-soon styling rules are kept and use the same calendar-day count.
- Decision (hosting): the app is hosted on Vercel's Hobby plan, with the built Vite front end and the dictation endpoints served from the same origin, the endpoints running as Vercel Functions. The browser connects directly to Speechmatics for realtime dictation.
- Early deployment validation: the first Vercel deployment must show more than the home page loading. It must show that `GET /api/dictation/status` and `POST /api/dictation/token` return the expected JSON, and that the deployed function loads and resolves its configuration, including the bundled `dictation.config.toml` and the existing environment-variable overrides. If the Vercel arrangement does not work as expected, stop and discuss alternatives before making substantial changes.
- Decision (shared implementation): the deployed dictation endpoints use the same request-handling implementation as local development, through a server module that does not depend on Vite.
- Extracting that module preserves existing server behaviour: the TOML defaults, the environment-variable overrides and their precedence, the HTTP status codes, the response headers including `Content-Type` and `Cache-Control`, and the API response shapes and behaviour.
- Constraint (Speechmatics authentication and security, carried over from TM-4): the long-lived Speechmatics API key stays server-side. It is held as a hosting secret, is not committed, and does not appear in client code, the production build or any response. The browser receives only short-lived credentials.
- The deployment reads the Speechmatics API key from a hosting environment variable. The same key may be used for local development and the deployment.
- When the deployment has no API key configured, the deployed app behaves as the local app does without one: it works, and shows dictation as unavailable.
- The local development workflow is unchanged: `npm run dev` and `npm run preview` work as they do today, with the same configuration files and no hosting account or hosting tools needed.
- The deployed endpoints are publicly reachable. No password protection, user accounts, origin restriction or other access control is added. The owner accepts the risk of unauthorised use of the token endpoint for this demonstration.
- Automated tests cover the production adapter and the behaviour of the deployed endpoints' code, without calling the real Speechmatics service or a hosting provider.
- Final deployment verification: after TM-4 has merged into `main` and its final changes are incorporated into TM-5, the final public address and deployed commit are recorded, and the deployed app is verified in Chrome and, if practical, one other mainstream browser, in a fresh browser session that is not signed in to anything.
- README contains a short, practical pre-demonstration checklist: confirm the public address works without signing in, check live microphone dictation, check stopping and restarting and persistence after refresh, check the remaining Speechmatics credit, and confirm the intended deployment and commit are live.
- README documents how the deployment is configured, including where the API key is kept and how the dictation settings reach the deployed endpoints, and how to update the deployed app, without exposing secrets.
- Constraint (dependency on TM-4): TM-5 is developed on a branch based on the TM-4 branch, in a separate worktree, keeping their shared history. TM-4 merges into `main` first. TM-5 then takes in the final TM-4 changes and passes validation again before it merges. TM-4's commits are not squashed or rewritten as part of TM-5.
- Changes to files introduced or changed by TM-4 are kept to what the deployment needs, because TM-4 is under review while this work proceeds.
- The deployed app reports visits and page views through Vercel Web Analytics, using Vercel's official package, so the owner can see whether the demonstration has been opened. No custom events, cookies, visitor identification or other analytics provider are added.
- The deployed app records dictation activity, so the owner can see whether dictation was used, including days or weeks later: that a session started, that recognised words first arrived, at most once per session, that a session completed, and that a session failed. Each record has the event name, a user label and a timestamp, and never transcript text, audio, keys, tokens or error messages. Recording is best-effort and never interrupts or delays dictation. No further analytics provider is added.
- Each record is written to the hosting provider's server log and saved to a Neon Postgres database connected to the Vercel project, using its `DATABASE_URL` connection string, which stays server-side. The database holds only the event name, the testing label and a server-generated timestamp. Its table is created once from an explicit SQL schema kept in the repository, not by the app at run time. Without `DATABASE_URL`, as in local development, records are only logged and no database connection is attempted. A database failure never affects dictation and is reported without credentials or error messages. The number of rows stored per day is capped in proportion to a small public demonstration.
- The owner can give a browser a named testing label, such as Robin, Dad or Claude, by opening the app with `?user=NAME`, without a visible control in the app, and how to do so is documented. A valid label in the address applies to that page at once and takes precedence over a stored one, including when the browser's storage is unavailable or refuses to save it, as can happen on iPhones and iPads. Where storage is available the label is stored in that browser only and kept for later visits without the parameter. `?user=PUBLIC` clears it. A label is a short string of letters, digits, hyphens and underscores, and an invalid value is rejected without changing anything. Records carry the label as their user, or PUBLIC when none is set, where PUBLIC means only "no label set" and not a confirmed outside visitor. IP addresses, user-agent strings, cookies and accounts are not used to tell visitors apart.
- Scope is proportionate to a personal demonstration with very low traffic. Keep the following outside this ticket: authentication or password protection, origin-based access restrictions, rate limiting and usage quotas, monitoring and alerting, custom domains, server-side storage of tasks, changes to TM-4 dictation behaviour, screen recordings or special microphone workarounds, and refactoring unrelated to deployment.

## Acceptance criteria

- The first Vercel deployment returns the expected JSON from `GET /api/dictation/status` and `POST /api/dictation/token`, with the token response carrying the model, language, realtime URL and timings from `dictation.config.toml`, and an environment-variable override taking effect when set.
- If that validation fails, the question is brought back for a decision before substantial changes are made.
- With no saved tasks, the five sample tasks are a completed task due 2 days ago, shown first as completed and not as overdue, then tasks due yesterday and in 2, 10 and 21 days, counted in local calendar days at any time of day, and saved tasks are loaded unchanged.
- Activating "Reset to sample tasks" by pointer or keyboard replaces the tasks with the sample tasks dated from today without a prompt or reload, the replacement survives a refresh, the assignee filter keeps its selection, and editing and dictation work afterwards.
- Due labels read "1 day overdue" for yesterday, "Due today" for today, "1 day remaining" for tomorrow, and "2", "10" and "21 days remaining" for those offsets, at any time of day and across month, year and daylight-saving boundaries.
- The front end and the dictation endpoints are served from the same Vercel deployment and origin.
- The deployed endpoints and the local Vite endpoints call the same request-handling code, which does not import Vite.
- After the extraction, the existing server tests pass without changes to what they assert.
- Automated tests of the production adapter assert, for the status request, a successful token request, a missing key, a rejected key, a service failure, a wrong method and an unknown path: the HTTP status code, the `Content-Type` and `Cache-Control` headers, and the response body.
- Automated tests show the production configuration uses the TOML defaults and gives environment variables precedence over them, as local development does.
- The long-lived API key does not appear in the repository, the client code, the production build, or any response from the deployed endpoints, including error responses.
- The deployment's API key is set as a hosting secret, and may be the same key that is used locally.
- With the hosting secret absent, the deployed app loads and shows dictation as unavailable.
- `npm run dev` and `npm run preview` start and support dictation locally exactly as before, without Vercel tooling installed.
- Build, lint and unit tests pass without calling the real Speechmatics service or Vercel.
- Final verification, after TM-4's final changes are incorporated, records the public address and the deployed commit, and confirms in Chrome, in a fresh session with no sign-in:
    - the address opens with no sign-in or password prompt;
    - the browser asks for microphone permission in the normal way, and dictation is live Speechmatics dictation;
    - recognised speech appears while speaking;
    - dictation can be stopped and started again;
    - the resulting task text survives a page refresh.
- The same checks are made in one other mainstream browser if practical, and the outcome, or the reason it was not practical, is recorded.
- README contains the pre-demonstration checklist with the five checks listed in Requirements.
- README explains how the deployment is configured, where the key is kept, and how to update the deployed app, and contains no secrets.
- TM-5 is not merged before TM-4. Before merging, the TM-5 branch contains the final TM-4 commits with their history intact, and build, lint and tests pass on the result.
- Vercel Web Analytics is included in the app with no custom events and no other analytics provider, and the app behaves the same with it as without.
- Starting dictation, the first recognised words, a normal stop and a failure each write one server log record with the event name, the user label and a timestamp, and with no transcript text or other content.
- Opening the app with `?user=NAME` labels that browser, its records then carry that name as their user on later visits too, `?user=PUBLIC` clears it, an invalid label is ignored, and a browser with no label records PUBLIC.
- With browser storage unavailable or refusing writes, the app still loads, and a page opened with `?user=NAME` reports that name.
- With activity recording failing or unreachable, dictation behaves as it does without it.
- With `DATABASE_URL` set and the schema applied, each event is saved as one row holding only its event name, testing label and timestamp, and stays available beyond the server log's retention.
- Without `DATABASE_URL`, events are logged and no database connection is attempted. With the database failing, the event is still logged, the response is unchanged, and nothing from the error beyond a database error code is logged.
- README gives the Neon configuration, the one-time schema setup, how to inspect stored events, and the limitations and privacy considerations.
- No authentication, access control, rate limiting or monitoring has been added.
