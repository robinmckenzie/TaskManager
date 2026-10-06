# TM-4 - Dictate a task title by voice

Status: Draft

## User problem

Typing a task title is slow or awkward when users want to capture a thought
quickly, are away from a comfortable keyboard, or find typing difficult. Users
want to speak a task title and see it appear, then correct it if needed.

## Requirements

- Each task's title can be dictated by voice from a control associated with that title, including a task just created with "+ Add Task".
- Dictation starts only when the user explicitly starts it, and stops when the user stops it or after a short pause in speech.
- Only one task can be dictated at a time.
- While dictating, recognised words appear in the title as the user speaks, before dictation finishes.
- Dictated text replaces the existing title. If nothing is recognised, the title is unchanged.
- If the user edits the title while dictating, dictation stops and the user's edit is kept.
- Names of the app's users, such as "Aaron", are favoured during recognition and spelled as they appear in the app.
- Recognition is for English speech.
- It is always clear whether dictation is active. The control has an accessible name, can be operated with the keyboard, and announces state changes to assistive technology.
- Audio is captured and sent only while dictation is active. Dictation ends when the user stops it, the task is deleted, or the page is closed or reloaded.
- A dictated title behaves like a typed title: it can be edited afterwards and is saved and restored on refresh. Saved task data does not change format, and no audio or transcript is stored.
- Failures are reported in plain language without losing the title, and the rest of the app keeps working. This covers microphone permission being denied, no microphone being available, the speech service being unavailable or the connection dropping, and dictation not being configured.
- When dictation is not configured or not supported, the app behaves as it does today apart from indicating that dictation is unavailable.
- Constraint (Speechmatics authentication and security): the long-lived Speechmatics API key must never reach the browser. It must not appear in client code, the production build, or responses to the browser, and must not be committed. The browser may use only short-lived credentials issued by a server-side component that holds the key.
- Constraint (browser security): microphone access requires a secure context, so dictation is only required to work over HTTPS or on localhost.
- Document in README how to configure and run dictation locally, including where the API key is kept.
- Keep voice input for other task fields, creating or editing tasks from spoken commands, voice notes, languages other than English, production hosting of the server-side component, per-user usage limits, and cross-browser testing outside this ticket.

## Acceptance criteria

- Each task, including a newly added one, offers a dictation control for its title.
- Starting dictation and speaking shows recognised words in the title while speaking, and the final text replaces the previous title.
- Dictation stops when the user stops it and after a short pause in speech.
- Starting dictation on one task while another is being dictated leaves only one active dictation.
- Stopping without recognised speech leaves the title unchanged.
- Typing in the title during dictation stops dictation and keeps the typed edit.
- Speaking a user's name, such as "Aaron", produces that name as spelled in the app.
- The control is reachable and operable by keyboard, its active state is visible, and state changes are announced to screen readers.
- No audio is sent when dictation is not active, including after the task is deleted mid-dictation.
- A dictated title survives refresh, and previously saved tasks load unchanged.
- Denied microphone permission, a missing microphone, a service or connection failure, and missing configuration each show a clear message, keep the title intact, and leave other task features working.
- Without dictation configured, the app runs and behaves as before apart from showing dictation as unavailable.
- The long-lived API key does not appear in the client code, the production build, browser network traffic, or the repository.
- Dictation controls do not start task drags, and existing drag-and-drop reordering, filtering and refresh persistence continue to work.
- README explains how to configure and run dictation locally.
- Build, lint and unit tests pass without calling the real Speechmatics service, and dictation is verified in the normal development browser with a real microphone.
