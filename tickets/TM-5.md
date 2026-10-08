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
- Decision (hosting): the app is hosted on Vercel's Hobby plan, with the built Vite front end and the dictation endpoints served from the same origin, the endpoints running as Vercel Functions. The browser connects directly to Speechmatics for realtime dictation.
- Early deployment validation: the first Vercel deployment must show more than the home page loading. It must show that `GET /api/dictation/status` and `POST /api/dictation/token` return the expected JSON, and that the deployed function loads and resolves its configuration, including the bundled `dictation.config.toml` and the existing environment-variable overrides. If the Vercel arrangement does not work as expected, stop and discuss alternatives before making substantial changes.
- Decision (shared implementation): the deployed dictation endpoints use the same request-handling implementation as local development, through a server module that does not depend on Vite.
- Extracting that module preserves existing server behaviour: the TOML defaults, the environment-variable overrides and their precedence, the HTTP status codes, the response headers including `Content-Type` and `Cache-Control`, and the API response shapes and behaviour.
- Constraint (Speechmatics authentication and security, carried over from TM-4): the long-lived Speechmatics API key stays server-side. It is held as a hosting secret, is not committed, and does not appear in client code, the production build or any response. The browser receives only short-lived credentials.
- The deployment uses its own Speechmatics API key, separate from the one used for local development, if the Speechmatics account allows more than one key. If it does not, the existing key is used.
- When the deployment has no API key configured, the deployed app behaves as the local app does without one: it works, and shows dictation as unavailable.
- The local development workflow is unchanged: `npm run dev` and `npm run preview` work as they do today, with the same configuration files and no hosting account or hosting tools needed.
- The deployed endpoints are publicly reachable. No password protection, user accounts, origin restriction or other access control is added. The owner accepts the risk of unauthorised use of the token endpoint for this demonstration.
- Automated tests cover the production adapter and the behaviour of the deployed endpoints' code, without calling the real Speechmatics service or a hosting provider.
- Final deployment verification: after TM-4 has merged into `main` and its final changes are incorporated into TM-5, the final public address and deployed commit are recorded, and the deployed app is verified in Chrome and, if practical, one other mainstream browser, in a fresh browser session that is not signed in to anything.
- README contains a short, practical pre-demonstration checklist: confirm the public address works without signing in, check live microphone dictation, check stopping and restarting and persistence after refresh, check the remaining Speechmatics credit, and confirm the intended deployment and commit are live.
- README documents how the deployment is configured, including where the API key is kept and how the dictation settings reach the deployed endpoints, and how to update the deployed app, without exposing secrets.
- Constraint (dependency on TM-4): TM-5 is developed on a branch based on the TM-4 branch, in a separate worktree, keeping their shared history. TM-4 merges into `main` first. TM-5 then takes in the final TM-4 changes and passes validation again before it merges. TM-4's commits are not squashed or rewritten as part of TM-5.
- Changes to files introduced or changed by TM-4 are kept to what the deployment needs, because TM-4 is under review while this work proceeds.
- Scope is proportionate to a personal demonstration with very low traffic. Keep the following outside this ticket: authentication or password protection, origin-based access restrictions, rate limiting and usage quotas, monitoring, alerting and analytics, custom domains, server-side storage of tasks, changes to TM-4 dictation behaviour, screen recordings or special microphone workarounds, and refactoring unrelated to deployment.

## Acceptance criteria

- The first Vercel deployment returns the expected JSON from `GET /api/dictation/status` and `POST /api/dictation/token`, with the token response carrying the model, language, realtime URL and timings from `dictation.config.toml`, and an environment-variable override taking effect when set.
- If that validation fails, the question is brought back for a decision before substantial changes are made.
- The front end and the dictation endpoints are served from the same Vercel deployment and origin.
- The deployed endpoints and the local Vite endpoints call the same request-handling code, which does not import Vite.
- After the extraction, the existing server tests pass without changes to what they assert.
- Automated tests of the production adapter assert, for the status request, a successful token request, a missing key, a rejected key, a service failure, a wrong method and an unknown path: the HTTP status code, the `Content-Type` and `Cache-Control` headers, and the response body.
- Automated tests show the production configuration uses the TOML defaults and gives environment variables precedence over them, as local development does.
- The long-lived API key does not appear in the repository, the client code, the production build, or any response from the deployed endpoints, including error responses.
- The deployment's API key is set as a hosting secret. If the account supports it, it is a different key from the local one.
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
- No authentication, access control, rate limiting or monitoring has been added.
