# TM-4 - Dictate a task title by voice

Status: Agreed

## User problem

Typing a task title is slow or awkward when users want to capture a thought
quickly, are away from a comfortable keyboard, or find typing difficult. Users
want to speak into a task title as they would type into it, and correct it as
they go.

## Requirements

- Dictation inserts recognised speech into the active supported text input, behaving as closely as practical like typing. Task-title inputs are currently the only supported text inputs, so dictation is offered on every task title, including a task just created with "+ Add Task".
- The capability is not unnecessarily tied to task titles or to single-line inputs, so that it can later be extended to other editable text controls, such as text areas, and so that spoken commands can be added later.
- Each task title offers a dictation control, which is part of that title's dictation UI. The control is available for pointer use and is keyboard-accessible in the normal way. Activating it leaves or returns focus to its title, preserving the title's cursor position or selection.
- Dictation starts only through explicit user action: activating a dictation control, or pressing the Ctrl + Alt shortcut. It stops when the user stops it in the same ways, or in the automatic cases described below. Pauses in speech shorter than the inactivity timeout do not stop it.
- Only one dictation can be active at a time. If dictation is active and the user activates another title's dictation control, the current dictation stops and a new dictation starts for that title. The existing session is not transferred.
- Ctrl + Alt means pressing Ctrl and Alt together with no third key. A chord in which another key is pressed together with Ctrl and Alt, such as Ctrl + Alt + T, does not toggle dictation.
- Ctrl + Alt is handled app-wide where practical. It starts dictation only when a supported text input is active, because recognised text needs a destination. When dictation is active, it stops dictation wherever focus is within the app, provided the shortcut can be reliably intercepted app-wide.
- Using the shortcut does not move or otherwise disturb the active input's cursor position or selection.
- While dictation is active, speech follows the current supported text input and its current cursor position or selection. Moving the cursor, changing the selection, or moving focus directly to another supported text input creates a new insertion point for subsequent speech. Moving focus between supported text inputs continues the same dictation session.
- If focus moves from a supported text input to something that is neither a supported text input nor that input's own dictation control, dictation stops, provided this is reasonably straightforward to implement. Moving focus from a title to its own dictation control does not count as leaving the input.
- When the first recognised text arrives for a new insertion point, the area around it is prepared once:
    - any selected text is deleted, leaving a single insertion point;
    - if the character immediately before the insertion point is a non-space character, a separating space is inserted before the insertion area;
    - if the character immediately after the insertion point is a non-space character, a separating space is inserted after the insertion area.
- Dictated text is then inserted and updated within that prepared area as recognition results arrive, and the cursor ends immediately after the dictated text, before any trailing separating space. The separating spaces belong to the surrounding text, not to the dictated text. No other punctuation or capitalisation rules are applied, and capitalisation at the insertion point is unspecified.
- Recognised speech appears in the input while the user is speaking, not only when dictation stops.
- Provisional text that is already displayed belongs to the insertion area where that speech began. If the user moves the cursor, changes the selection or moves focus while that text is still being revised, revisions continue to update it in its original area, and subsequent new speech goes to the new insertion point.
- If the user deliberately edits text that is still provisional, their edit wins and that area stops receiving further revisions.
- Keyboard editing while dictating does not stop dictation, and both typed and dictated text are kept.
- If no speech is recognised, the input is unchanged, including no separating spaces being added.
- Inactivity timeout: dictation stops automatically after 10 seconds in which no speech is being successfully recognised. Investigation determines how Speechmatics provisional and final results behave and which events implement this. If investigation reveals a meaningful product choice rather than an implementation detail, bring it back for a decision.
- Maximum session duration: a dictation session stops automatically after a maximum of 20 seconds, however much speech is being recognised. Recognised speech and moving focus between supported text inputs do not reset or extend this maximum, and starting dictation again starts a fresh session. The 20 seconds is an initial value, defined in a single, easily changed place, because it is expected to be tuned after the feature has been used.
- Deleting the task containing the active dictation input stops dictation. Deleting another task does not by itself stop dictation, although moving focus to do so may stop it under the focus rule.
- When the configured model supports a custom vocabulary, names of the app's users, such as "Aaron", are favoured during recognition and spelled as they appear in the app.
- The Speechmatics model and language are set by configuration, without code changes. The default is a production model with a single configured language, English unless configured otherwise. A multilingual model, such as the Melia 1 realtime preview, can be configured for experimentation. TaskManager does not restrict recognition beyond what the configured model and language support.
- Constraint (Speechmatics preview terms): Speechmatics states that preview models are for evaluation only and not for production use, so a preview model is never the default.
- It is always clear whether dictation is active. The control has an accessible name, can be operated with the keyboard, and state changes, including automatic stops, are announced to assistive technology.
- Audio is captured and sent only while dictation is active, and dictation ends when the page is closed or reloaded.
- When dictation stops for any reason, audio capture and sending stop immediately and the control shows dictation as stopped. Text already being recognised is then allowed to settle for a short, bounded period: final results that arrive replace the corresponding provisional text in its original area. Provisional text that has not been finalised when the period ends is kept as displayed.
- A dictated title behaves like a typed title: it can be edited afterwards and is saved and restored on refresh. Saved task data does not change format, and no audio or transcript is stored.
- Failures are reported in plain language without losing text already in the input, and the rest of the app keeps working. This covers microphone permission being denied, no microphone being available, the speech service being unavailable or the connection dropping, and dictation not being configured.
- When dictation is not configured or not supported, the app behaves as it does today apart from indicating that dictation is unavailable.
- Constraint (Speechmatics authentication and security): the long-lived Speechmatics API key must never reach the browser. It must not appear in client code, the production build, or responses to the browser, and must not be committed. The browser may use only short-lived credentials issued by a server-side component that holds the key.
- Constraint (browser security): microphone access requires a secure context, so dictation is only required to work over HTTPS or on localhost.
- Document in README how to configure and run dictation locally, including where the API key is kept and how to configure the model and language, and how to use dictation, including the Ctrl + Alt shortcut and when dictation stops automatically: after a period in which no speech is recognised, after a maximum session duration, when focus leaves a supported text input, and when the task being dictated is deleted.
- Keep the following outside this ticket: adding text areas or other new kinds of editable text control, voice input for non-text task fields such as assignee, due date and priority, spoken commands that perform actions or create or edit task data, voice notes, production hosting of the server-side component, per-user usage limits, and cross-browser testing.

## Acceptance criteria

- Each task title, including a newly added one, offers a dictation control.
- Dictation starts and stops when the user activates the control, by pointer or by keyboard in the normal way, or presses Ctrl + Alt.
- A keyboard user can place the cursor or make a selection in a title, Tab to that title's dictation control, activate it with the keyboard, and dictate with focus back in the title at the preserved cursor position or selection.
- Activating the dictation control by pointer keeps the title's existing cursor position or selection as the insertion point.
- Moving focus from a title to its own dictation control does not stop dictation.
- With a task title active, pressing Ctrl and Alt together with no other key starts dictation if it is stopped and stops it if it is active.
- Pressing Ctrl + Alt together with another key, such as Ctrl + Alt + T, does not toggle dictation.
- With no supported text input active, Ctrl + Alt does not start dictation.
- While dictation is active, Ctrl + Alt stops it wherever focus is within the app, unless planning records that app-wide interception is not practical.
- Using the shortcut leaves the active input's cursor position and selection unchanged.
- While dictation is active for one task, activating another task's dictation control stops the first dictation and starts a new dictation for the other task.
- Only one dictation is ever active at a time.
- After the user moves the cursor or changes the selection during dictation, subsequent speech is inserted at the new position.
- After the user moves focus directly to another task title during dictation, the same session continues and subsequent speech is inserted into that title at its cursor position or selection.
- Moving focus from a task title to something that is neither a supported text input nor its own dictation control stops dictation, unless planning records that this is not reasonably straightforward.
- Dictating "urgent" at `Fix|bug` prepares `Fix | bug` and produces `Fix urgent| bug`. If recognition extends the phrase to "urgent problem", the result is `Fix urgent problem| bug`.
- Dictating "bug" at `Fix|` produces `Fix bug|`.
- Dictating "bug" at `Fix |` produces `Fix bug|`, with no doubled space.
- Dictating "new" with "old" selected in `Fix old bug` produces `Fix new| bug`.
- Dictating into an empty title adds no separating spaces.
- Separating spaces are added once when the first recognised text arrives for an insertion point, not separately for each recognition result.
- Recognised speech appears in the input while the user is speaking.
- Provisional text that is revised after the user moves the cursor, selection or focus is updated in its original area, and subsequent speech goes to the new insertion point.
- Editing text that is still provisional keeps the user's edit, and later revisions do not overwrite it.
- Typing, deleting and moving the cursor with the keyboard during dictation do not stop dictation, and typed and dictated text are both kept.
- Starting and stopping dictation without recognised speech leaves the input unchanged, with no separating spaces added.
- Pauses shorter than 10 seconds between recognised speech do not stop dictation.
- After 10 seconds in which no speech is being successfully recognised, dictation stops automatically, including when there is background audio that produces no recognised speech.
- A dictation session stops automatically after 20 seconds even while speech is continuously recognised, and moving focus between titles does not extend it.
- Starting dictation again after any stop begins a fresh 20-second session.
- The maximum session duration is defined in one place and can be changed without changing other behaviour.
- Automatic stops are visible and announced to screen readers.
- Deleting the task containing the active dictation input stops dictation. Deleting another task does not by itself stop dictation, although moving focus to do so may stop it under the focus rule.
- When the configured model supports a custom vocabulary, each dictation session supplies the app's user names, spelled as they appear in the app, to Speechmatics through that mechanism. When it does not, dictation works without them.
- By default, dictation uses a production model with a single configured language, and the model and language can be changed through configuration without code changes, including to a multilingual preview model.
- After any stop, no further audio is sent and the control shows dictation as stopped immediately. Final results arriving within the settling period replace provisional text in its original area, and provisional text not finalised by the end of the period is kept as displayed.
- The control is reachable and operable by keyboard, its active state is visible, and state changes are announced to screen readers.
- No audio is sent when dictation is not active, including after any automatic stop.
- A dictated title survives refresh, and previously saved tasks load unchanged.
- Denied microphone permission, a missing microphone, a service or connection failure, and missing configuration each show a clear message, keep text already in the input, and leave other task features working.
- Without dictation configured, the app runs and behaves as before apart from showing dictation as unavailable.
- The long-lived API key does not appear in the client code, the production build, browser network traffic, or the repository.
- Dictation controls do not start task drags, and existing drag-and-drop reordering, filtering and refresh persistence continue to work.
- README explains how to configure and run dictation locally, including the model and language, and how to use it, including the Ctrl + Alt shortcut and each automatic stop.
- Build, lint and unit tests pass without calling the real Speechmatics service. Dictation is verified in the normal development browser with a real microphone, including a check that user names are recognised sensibly, which is not a pass/fail requirement for any particular spoken name.
