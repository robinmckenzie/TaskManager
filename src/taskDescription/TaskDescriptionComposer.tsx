import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import type { FC } from "react"
import { MicrophoneIcon } from "../dictation/MicrophoneIcon"
import { DESCRIPTION_TARGET_ID } from "../dictation/dictationController"
import type { Dictation } from "../dictation/useDictation"
import {
    acceptUncertainty,
    closeAttempt,
    createFromAttempt,
    describeDueDate,
    editField,
    typeDescription,
    viewAttempt,
} from "./descriptionAttempt"
import type {
    AttemptField,
    AttemptFields,
    AttemptUncertainty,
    AttemptView,
    CreateBlocker,
} from "./descriptionAttempt"
import { createAttemptStore } from "./descriptionCapture"
import type { DescriptionAssignee } from "./interpretDescription"

interface TaskDescriptionComposerProps {
    users: readonly DescriptionAssignee[]
    /** The assignee a new task gets when the description names none. */
    defaultUserId: string
    today: Date
    dictation: Dictation
    onCreate(fields: AttemptFields): void
    onCancel(): void
}

const describeBlocker = (blocker: CreateBlocker | undefined): string => {
    switch (blocker) {
        case "capturing":
            return "Stop the microphone before creating the task."
        case "finishing":
            return "Waiting for the last recognised words."
        case "blank_title":
            return "Give the task a title to create it."
        case "unresolved":
            return "Deal with what needs checking to create the task."
        case undefined:
            return ""
    }
}

const describeAcceptance = (uncertainty: AttemptUncertainty): string => {
    switch (uncertainty.field) {
        case "dueDate":
            return "Use displayed due date"
        case "priority":
            return "Use displayed priority"
        case "userId":
            return "Use displayed assignee"
        case null:
            return "Keep the description as shown"
    }
}

const getMicrophoneTitle = (dictation: Dictation, view: AttemptView): string => {
    if (view.captureState === "finishing") {
        return "Waiting for the last recognised words"
    }

    if (view.captureState !== "none") {
        return "Stop describing by voice (Ctrl + Alt)"
    }

    switch (dictation.availability) {
        case "available":
            return "Describe the task by voice (Ctrl + Alt)"
        case "checking":
            return "Checking whether dictation is available"
        case "not_configured":
            return "Dictation is not configured"
        case "unsupported":
            return "Dictation is not supported in this browser"
    }
}

/**
 * Describes one new task by typing or by voice. The description stays in view
 * while the proposed title, due date, priority and assignee are worked out
 * from it, and each can be corrected by hand. Nothing is created until Create
 * task is chosen.
 */
export const TaskDescriptionComposer: FC<TaskDescriptionComposerProps> = ({
    users,
    defaultUserId,
    today,
    dictation,
    onCreate,
    onCancel,
}) => {
    const [store] = useState(() => createAttemptStore({ referenceDay: today, assignees: users, defaultUserId }))
    const attempt = useSyncExternalStore(store.subscribe, store.read)
    const view = viewAttempt(attempt, today)
    const { fields, captureState } = view
    const description = useRef<HTMLTextAreaElement>(null)
    const dueDateInput = useRef<HTMLInputElement>(null)
    const checks = useRef<HTMLDivElement>(null)
    const createButton = useRef<HTMLButtonElement>(null)
    const moveFocusAfterRender = useRef<(() => void) | null>(null)
    const { registerDescriptionComposer, stopDescriptionCapture } = dictation

    useEffect(() => {
        moveFocusAfterRender.current?.()
        moveFocusAfterRender.current = null
    })

    useEffect(() => {
        description.current?.focus()
    }, [])

    // The microphone must not outlive the composer.
    useEffect(() => stopDescriptionCapture, [stopDescriptionCapture])

    const isCapturing = captureState === "starting" || captureState === "listening"
    const isActiveTarget = dictation.phase !== "idle" && dictation.activeTargetId === DESCRIPTION_TARGET_ID
    const canToggleMicrophone = captureState !== "finishing" && dictation.availability === "available"

    const changeField = (field: AttemptField, value: string | number): void =>
        store.write(editField(store.read(), field, value, dictation.readDescriptionAudioTime()))

    const createTask = (): void => {
        const created = createFromAttempt(store.read(), today)

        if (created) {
            store.write(created.attempt)
            onCreate(created.fields)
        }
    }

    // Accepting removes the button that was pressed, and clearing the due
    // date disables its button, so each moves focus on to a control that stays.
    const acceptAndMoveFocus = (key: string): void => {
        store.write(acceptUncertainty(store.read(), key))
        moveFocusAfterRender.current = (): void =>
            (checks.current?.querySelector("button") ?? createButton.current)?.focus()
    }

    const clearDueDate = (): void => {
        changeField("dueDate", "")
        dueDateInput.current?.focus()
    }

    const cancel = (): void => {
        store.write(closeAttempt(store.read()))
        stopDescriptionCapture()
        onCancel()
    }

    return (
        <section
            className="describe-task"
            aria-labelledby="describe-task-heading"
            // Clicking an empty part keeps focus inside, so a capture continues.
            tabIndex={-1}
            ref={(element): void =>
                registerDescriptionComposer(element && {
                    element,
                    attempts: store,
                    focus: () => description.current?.focus(),
                })
            }
        >
            <h2 id="describe-task-heading">Describe a task</h2>

            <div className="describe-task-description">
                <label htmlFor="describe-task-description">Description</label>
                <div className="describe-task-description-row">
                    <textarea
                        id="describe-task-description"
                        ref={description}
                        rows={3}
                        value={attempt.text}
                        readOnly={captureState !== "none"}
                        aria-describedby="describe-task-guide"
                        onChange={(event): void => store.write(typeDescription(store.read(), event.target.value))}
                    />
                    <button
                        type="button"
                        className={`dictation-button${captureState === "starting" ? " dictation-button-starting" : ""}`}
                        aria-pressed={isCapturing && isActiveTarget}
                        aria-disabled={canToggleMicrophone ? undefined : true}
                        aria-label={isCapturing ? "Stop describing by voice" : "Describe the task by voice"}
                        title={getMicrophoneTitle(dictation, view)}
                        // Keep focus where it is in the composer.
                        onMouseDown={(event): void => event.preventDefault()}
                        onClick={(): void => {
                            if (captureState !== "finishing") {
                                dictation.toggleDescriptionCapture()
                            }
                        }}
                    >
                        <MicrophoneIcon />
                    </button>
                </div>
                <div id="describe-task-guide" className="describe-task-guide">
                    <p>
                        Type or say the title, then any of these phrases:{" "}
                        <q>due tomorrow</q>, <q>due Friday</q>, <q>due 15 October</q>, <q>no due date</q>,{" "}
                        <q>high priority</q>, <q>priority 2</q>, <q>assigned to {users[0]?.name ?? "a name"}</q>.
                        A later phrase replaces an earlier one.
                    </p>
                    <p>
                        Guided phrases are understood in English only. Priority 1 is highest, 5 is lowest.
                        Not kept if you refresh or close the page.
                    </p>
                </div>
            </div>

            {view.unsupportedLanguage && (
                <p className="describe-task-language">
                    Recognition is set to {view.unsupportedLanguage}; guided phrases are understood in English
                    only.
                </p>
            )}

            <div className="describe-task-fields">
                <label className="describe-task-title">
                    Title
                    <input
                        type="text"
                        value={fields.title}
                        onChange={(event): void => changeField("title", event.target.value)}
                    />
                </label>

                <div className="describe-task-due">
                    <label>
                        Due date
                        <input
                            type="date"
                            ref={dueDateInput}
                            value={fields.dueDate}
                            onChange={(event): void => changeField("dueDate", event.target.value)}
                        />
                    </label>
                    <span>{describeDueDate(fields.dueDate)}</span>
                    <button
                        type="button"
                        className="describe-task-link"
                        disabled={!fields.dueDate}
                        onClick={clearDueDate}
                    >
                        Clear due date
                    </button>
                </div>

                <label className="priority-control">
                    <span>Priority: {fields.priority}/5 - 1 highest, 5 lowest</span>
                    <input
                        type="range"
                        min="1"
                        max="5"
                        step="1"
                        value={fields.priority}
                        aria-valuetext={`${fields.priority} of 5, where 1 is highest and 5 is lowest`}
                        onChange={(event): void => changeField("priority", Number(event.target.value))}
                    />
                </label>

                <label>
                    Assignee
                    <select
                        value={fields.userId}
                        onChange={(event): void => changeField("userId", event.target.value)}
                    >
                        {users.map((user) => (
                            <option key={user.id} value={user.id}>
                                {user.name}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            {/* Always present, so that a change in what it lists is announced. */}
            <div className="describe-task-checks" role="status" ref={checks}>
                {view.uncertainties.length > 0 && (
                    <>
                        <h3>Needs checking</h3>
                        <ul>
                            {view.uncertainties.map((uncertainty) => (
                                <li key={uncertainty.key}>
                                    {uncertainty.message}{" "}
                                    <button
                                        type="button"
                                        className="describe-task-link"
                                        onClick={(): void => acceptAndMoveFocus(uncertainty.key)}
                                    >
                                        {describeAcceptance(uncertainty)}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </div>

            <div className="describe-task-actions">
                <button
                    type="button"
                    className="add-button"
                    ref={createButton}
                    aria-disabled={view.canCreate ? undefined : true}
                    aria-describedby="describe-task-create-hint"
                    onClick={createTask}
                >
                    Create task
                </button>
                <button type="button" className="describe-task-cancel" onClick={cancel}>
                    Cancel
                </button>
                <span id="describe-task-create-hint">{describeBlocker(view.blockers[0])}</span>
            </div>
        </section>
    )
}
