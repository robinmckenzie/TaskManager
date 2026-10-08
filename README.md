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

Dictate into a task title with the microphone button beside it, or press Ctrl
and Alt together (with no other key) while editing a title. Press either again to
stop. Recognised speech is inserted at the cursor, replacing any selected text,
with a space added where it meets existing words. Words appear as you speak and
may be corrected for a few seconds, including just after you stop. Moving the
cursor, or moving to another task title, sends further speech there. Dictation
stops automatically after a period without recognised speech (10 seconds by
default), after a maximum time (20 seconds by default), when focus leaves the
task titles, or when the task being dictated is deleted. A status line above the task list reports these changes and any
problems, such as a blocked microphone. Dictation needs setting up first; see
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
| `[timings] inactivity_timeout_seconds` | `10` | Stop after this many seconds without recognised speech. |
| `[timings] max_session_seconds` | `20` | Maximum length of one dictation session. |
| `[timings] settle_timeout_seconds` | `4` | How long recognised text may keep settling after dictation stops. |

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

- Public address: not yet recorded. It is added here after the final
  verification of the deployment.
- The functions are `api/dictation/status.ts` and `api/dictation/token.ts`.
  Both run the handler that local development uses, in
  `server/dictationHandler.ts`.
- The Speechmatics API key is the `SPEECHMATICS_API_KEY` environment variable
  in the Vercel project's settings. It is not in the repository, and it is a
  different key from the one used locally so that either can be revoked alone.
  Without it the deployed app works and shows dictation as unavailable.
- The other dictation settings come from `dictation.config.toml`, which
  `vercel.json` deploys with the functions. `SPEECHMATICS_MODEL`,
  `SPEECHMATICS_LANGUAGE` and `SPEECHMATICS_RT_URL` can be set in Vercel to
  override it, as they can locally.
- Vercel compiles the functions with the options in the root `tsconfig.json`.
- The endpoints are public and have no access control. Usage is limited by the
  Speechmatics account's credit.

To update the deployed app, push to the branch that Vercel deploys as
production. Vercel builds and deploys it automatically. After changing an
environment variable in Vercel, redeploy for it to take effect. Running the app
locally needs no Vercel account or tools.

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
