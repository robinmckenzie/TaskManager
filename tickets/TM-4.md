# TM-4 - Dictate a task title by voice

Status: Draft

## User problem

Typing a task title is slow or awkward when users want to capture a thought
quickly, are away from a comfortable keyboard, or find typing difficult. Users
want to speak into a task title as they would type into it, and correct it as
they go.

## Requirements

- Each task's title can be dictated by voice from a control associated with that title, including a task just created with "+ Add Task".
- Dictation starts and stops only through explicit user action: activating the dictation control, or pressing the Ctrl + Alt keyboard shortcut. Pauses in speech do not stop it.
- While the user is editing a task title, pressing Ctrl and Alt together, with no third key required, toggles dictation: it starts dictation for that title if dictation is stopped, and stops dictation if it is active.
- Using the shortcut does not move or otherwise disturb the title's cursor position or selection.
- The dictation control remains available for pointer use and is keyboard-accessible in the normal way.
- Only one task's title can be dictated at a time.
- Dictation behaves like typing into the title from the microphone: recognised speech is inserted at the title's current cursor position, and replaces any selected text.
- If the user moves the cursor or changes the selection while dictating, subsequent speech is inserted at the new position.
- Activating the dictation control does not lose the title's cursor position or selection.
- Keyboard editing of the title while dictating does not stop dictation, and both typed and dictated text are kept.
- Recognised speech appears in the title while the user is speaking, not only when dictation stops.
- If no speech is recognised, the title is unchanged.
- Names of the app's users, such as "Aaron", are favoured during recognition and spelled as they appear in the app.
- Recognition is for English speech.
- It is always clear whether dictation is active. The control has an accessible name, can be operated with the keyboard, and announces state changes to assistive technology.
- Audio is captured and sent only while dictation is active. Dictation ends when the user stops it, the task is deleted, or the page is closed or reloaded.
- A dictated title behaves like a typed title: it can be edited afterwards and is saved and restored on refresh. Saved task data does not change format, and no audio or transcript is stored.
- Failures are reported in plain language without losing text already in the title, and the rest of the app keeps working. This covers microphone permission being denied, no microphone being available, the speech service being unavailable or the connection dropping, and dictation not being configured.
- When dictation is not configured or not supported, the app behaves as it does today apart from indicating that dictation is unavailable.
- Constraint (Speechmatics authentication and security): the long-lived Speechmatics API key must never reach the browser. It must not appear in client code, the production build, or responses to the browser, and must not be committed. The browser may use only short-lived credentials issued by a server-side component that holds the key.
- Constraint (browser security): microphone access requires a secure context, so dictation is only required to work over HTTPS or on localhost.
- Document in README how to configure and run dictation locally, including where the API key is kept, and how to use dictation, including the Ctrl + Alt shortcut.
- Keep dictation into text inputs other than task titles, voice input for other task fields, creating or editing tasks from spoken commands, voice notes, languages other than English, production hosting of the server-side component, per-user usage limits, and cross-browser testing outside this ticket.

## Acceptance criteria

- Each task, including a newly added one, offers a dictation control for its title, and no other text input offers dictation.
- Dictation starts and stops only when the user activates the control, by pointer or by keyboard in the normal way, or presses Ctrl + Alt.
- While editing a task title, pressing Ctrl and Alt together, with no other key, starts dictation if it is stopped and stops it if it is active.
- Using the shortcut leaves the title's cursor position and selection unchanged.
- In text inputs other than task titles, the shortcut does not start dictation.
- Dictation remains active through pauses in speech until the user stops it.
- Starting dictation on one task while another is being dictated leaves only one active dictation.
- With the cursor in the middle of a title, dictated speech is inserted at the cursor and the surrounding text is kept.
- With text selected in a title, dictated speech replaces the selection.
- After the user moves the cursor or changes the selection during dictation, subsequent speech is inserted at the new position.
- Activating the dictation control keeps the title's existing cursor position or selection as the insertion point.
- Typing, deleting and moving the cursor with the keyboard during dictation do not stop dictation, and typed and dictated text are both kept.
- Recognised speech appears in the title while the user is speaking.
- Starting and stopping dictation without recognised speech leaves the title unchanged.
- Speaking a user's name, such as "Aaron", produces that name as spelled in the app.
- The control is reachable and operable by keyboard, its active state is visible, and state changes are announced to screen readers.
- No audio is sent when dictation is not active, including after the task is deleted mid-dictation.
- A dictated title survives refresh, and previously saved tasks load unchanged.
- Denied microphone permission, a missing microphone, a service or connection failure, and missing configuration each show a clear message, keep text already in the title, and leave other task features working.
- Without dictation configured, the app runs and behaves as before apart from showing dictation as unavailable.
- The long-lived API key does not appear in the client code, the production build, browser network traffic, or the repository.
- Dictation controls do not start task drags, and existing drag-and-drop reordering, filtering and refresh persistence continue to work.
- README explains how to configure and run dictation locally, and how to use it, including the Ctrl + Alt shortcut.
- Build, lint and unit tests pass without calling the real Speechmatics service, and dictation is verified in the normal development browser with a real microphone.
