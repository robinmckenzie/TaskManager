import { useEffect, useLayoutEffect, useRef, useState } from "react"
import type { DragEvent, FC, FocusEvent, KeyboardEvent, MouseEvent, RefObject } from "react"
import { format, parseISO } from "date-fns"
import { describeDueStatus, getDaysUntilDue } from "../../dueDates"
import { reorderTasks } from "../../tasks"
import type { TaskType } from "../../tasks"
import { getTaskControlNames } from "../../taskControlNames"
import { sortAssigneesByName } from "../../users"
import { describeDictationPhase } from "../../dictation/dictationMessages"
import { LevelMeter } from "../../dictation/LevelMeter"
import type { BarLook, MeterChoice, MeterStyle, NeedleLook, WaveformLook } from "../../dictation/LevelMeter"
import { MicrophoneIcon } from "../../dictation/MicrophoneIcon"
import { createPrototypeTasks, getTaskState, prototypeUsers } from "../sampleTasks"
import type { PrototypeUser, TaskState } from "../sampleTasks"
import { readSimulatedLevel, useSimulatedDictation } from "../simulatedDictation"
import type { SimulatedAvailability, SimulatedDictation } from "../simulatedDictation"
import { getQuickDueDates, updateTaskInList } from "./quickDueDates"

/*
 * TM #56 prototype: Modern. A sidebar and a compact, column-aligned task list.
 * Each row shows the title in full and a summary of its details; the details
 * are edited in a panel that opens beneath the row. Tasks are kept in memory
 * only, and browser storage is never read or written.
 *
 * Class names start with `md-`. Nothing here is shared with Refined apart from
 * the sample data and the simulated dictation.
 */

/** How the row's secondary controls (grip and microphone) are shown. A reviewer option. */
type RowControls = "reveal" | "always"

/** Which detail a click on the row summary should focus when the panel opens. */
type DetailField = "due" | "priority" | "assignee"

const alphabeticalUsers = sortAssigneesByName(prototypeUsers)

/* ---------- Icons ---------- */

const Icon: FC<{ path: string; className?: string; size?: number }> = ({ path, className, size = 16 }) => (
    <svg className={className} viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
        <path d={path} fill="currentColor" />
    </svg>
)

const ICONS = {
    mark: "M3 1.5h10A1.5 1.5 0 0 1 14.5 3v10a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 13V3A1.5 1.5 0 0 1 3 1.5Zm8.03 4.47a.75.75 0 0 0-1.06 0L7 8.94 6.03 7.97a.75.75 0 1 0-1.06 1.06l1.5 1.5a.75.75 0 0 0 1.06 0l3.5-3.5a.75.75 0 0 0 0-1.06Z",
    plus: "M7.25 2.75a.75.75 0 0 1 1.5 0v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5Z",
    grip: "M6 3a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm4 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2ZM6 7a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm4 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm-4 4a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm4 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z",
    chevron: "M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z",
    trash: "M6 1.75A.75.75 0 0 1 6.75 1h2.5a.75.75 0 0 1 .75.75V3h3.25a.75.75 0 0 1 0 1.5h-.4l-.7 9.1A1.5 1.5 0 0 1 10.65 15h-5.3a1.5 1.5 0 0 1-1.5-1.4L3.15 4.5h-.4a.75.75 0 0 1 0-1.5H6V1.75ZM4.66 4.5l.69 9h5.3l.69-9H4.66Z",
    gear: "M6.6 1.3a.6.6 0 0 1 .6-.5h1.6a.6.6 0 0 1 .6.5l.2 1.3c.4.2.8.4 1.1.6l1.2-.5a.6.6 0 0 1 .7.3l.8 1.4a.6.6 0 0 1-.1.7l-1 .8a4.6 4.6 0 0 1 0 1.3l1 .8c.2.2.3.5.1.7l-.8 1.4a.6.6 0 0 1-.7.3l-1.2-.5c-.3.3-.7.5-1.1.6l-.2 1.3a.6.6 0 0 1-.6.5H7.2a.6.6 0 0 1-.6-.5l-.2-1.3a4.4 4.4 0 0 1-1.1-.6l-1.2.5a.6.6 0 0 1-.7-.3l-.8-1.4a.6.6 0 0 1 .1-.7l1-.8a4.6 4.6 0 0 1 0-1.3l-1-.8a.6.6 0 0 1-.1-.7l.8-1.4a.6.6 0 0 1 .7-.3l1.2.5c.3-.3.7-.5 1.1-.6l.2-1.3ZM8 10.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z",
    info: "M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1Zm-.75 6v4.5h1.5V7h-1.5Zm0-2.5V6h1.5V4.5h-1.5Z",
    users: "M5.5 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Zm5.5 1a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM1 12.5C1 10.6 3 9 5.5 9S10 10.6 10 12.5V14H1v-1.5Zm10.5 1.5v-1.5c0-1-.3-1.9-.9-2.6 2.2-.1 4.4 1 4.4 2.6V14h-3.5Z",
    /* Due states. Each has its own shape, so that state never depends on colour. */
    warning: "M7.13 1.5a1 1 0 0 1 1.74 0l6.5 11.5a1 1 0 0 1-.87 1.5H1.5a1 1 0 0 1-.87-1.5l6.5-11.5ZM7.25 5.5v4h1.5v-4h-1.5Zm0 5.25v1.5h1.5v-1.5h-1.5Z",
    clock: "M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1Zm0 1.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Zm.75 2v3.19l2.03 2.03-1.06 1.06L7.25 8.31V4.5h1.5Z",
    calendar: "M5 1h1.5v1.5h3V1H11v1.5h1.5A1.5 1.5 0 0 1 14 4v8.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12.5V4a1.5 1.5 0 0 1 1.5-1.5H5V1ZM3.5 6.5v6h9v-6h-9Z",
    arrow: "M2 8a.75.75 0 0 1 .75-.75h8.69L8.97 4.78a.75.75 0 0 1 1.06-1.06l3.75 3.75a.75.75 0 0 1 0 1.06l-3.75 3.75a.75.75 0 1 1-1.06-1.06l2.47-2.47H2.75A.75.75 0 0 1 2 8Z",
    dash: "M3 7.25h10v1.5H3z",
    check: "M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1Zm3.03 4.47a.75.75 0 0 0-1.06 0L7 8.44 6.03 7.47a.75.75 0 1 0-1.06 1.06l1.5 1.5a.75.75 0 0 0 1.06 0l3.5-3.5a.75.75 0 0 0 0-1.06Z",
}

const STATE_ICONS: Record<TaskState, string> = {
    overdue: ICONS.warning,
    "due-soon": ICONS.clock,
    "due-this-week": ICONS.calendar,
    "due-later": ICONS.arrow,
    "no-due-date": ICONS.dash,
    completed: ICONS.check,
}

/* ---------- Small pieces ---------- */

const Avatar: FC<{ user: PrototypeUser | undefined; size?: "sm" | "md" }> = ({ user, size = "sm" }) => {
    const [failed, setFailed] = useState(false)

    return (
        <span className={`md-avatar md-avatar-${size}`} aria-hidden="true">
            <span className="md-avatar-initials">{user?.initials ?? "?"}</span>
            {user && !failed && (
                <img src={user.photo} alt="" draggable={false} onError={(): void => setFailed(true)} />
            )}
        </span>
    )
}

/** Five rising bars, filled up to the priority. The number beside them carries the value too. */
const PriorityBars: FC<{ priority: number }> = ({ priority }) => (
    <svg className="md-priority-bars" viewBox="0 0 19 12" width="19" height="12" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((level) => (
            <rect
                key={level}
                className={level <= priority ? "md-bar-on" : "md-bar-off"}
                x={(level - 1) * 4}
                y={12 - (level + 1) * 2}
                width="3"
                height={(level + 1) * 2}
                rx="0.75"
            />
        ))}
    </svg>
)

const formatShortDate = (dueDate: string): string => (dueDate ? format(parseISO(dueDate), "d MMM") : "")

/* ---------- Dictation ---------- */

const getDictationButtonTitle = (dictation: SimulatedDictation, isActive: boolean): string => {
    if (isActive) {
        return "Stop dictation (Ctrl + Alt)"
    }

    return dictation.availability === "available"
        ? "Dictate into this title (Ctrl + Alt)"
        : "Dictation is not configured"
}

const DictationButton: FC<{
    targetId: string
    targetName: string
    dictation: SimulatedDictation
    onToggle(): void
}> = ({ targetId, targetName, dictation, onToggle }) => {
    const isActive = dictation.phase !== "idle" && dictation.activeTargetId === targetId
    const isAvailable = dictation.availability === "available"

    return (
        <button
            type="button"
            className={`md-mic md-reveal${isActive ? ` md-mic-active md-mic-${dictation.phase}` : ""}`}
            aria-pressed={isActive}
            aria-disabled={isAvailable ? undefined : true}
            aria-label={`${isActive ? "Stop" : "Start"} dictation into ${targetName}`}
            title={getDictationButtonTitle(dictation, isActive)}
            // Keep the cursor in the title, as the app does.
            onMouseDown={(event): void => event.preventDefault()}
            onClick={onToggle}
        >
            <MicrophoneIcon />
        </button>
    )
}

/**
 * The dictation status floats at the foot of the list, close to where the
 * eye is while dictating, and takes no space in the page when there is
 * nothing to say. The live region itself is always present.
 */
const DictationStatus: FC<{ dictation: SimulatedDictation; meter: MeterChoice }> = ({ dictation, meter }) => {
    const { phase, message } = dictation
    const stateText = describeDictationPhase(phase)
    const isEmpty = !stateText && !message

    return (
        <div className={`md-status${isEmpty ? " md-status-empty" : ""}`}>
            <span className={`md-status-dot md-status-dot-${phase}`} aria-hidden="true" />
            <p className="md-status-text" role="status">
                {stateText && <strong>{stateText}</strong>}
                {stateText && message && " "}
                {message}
            </p>
            {phase === "listening" && (
                <span className="md-status-meter">
                    <LevelMeter choice={meter} readLevel={dictation.readAudioLevel} />
                </span>
            )}
        </div>
    )
}

/* ---------- Level meter choice, in Settings ---------- */

interface Option<T> {
    value: T
    label: string
}

const METER_STYLES: Option<MeterStyle>[] = [
    { value: "bar", label: "Horizontal bar" },
    { value: "needle", label: "Analogue needle" },
    { value: "waveform", label: "Waveform" },
]

const LOOKS: { [S in MeterStyle]: { label: string; options: Option<MeterChoice[S]>[] } } = {
    bar: {
        label: "Horizontal bar look",
        options: [
            { value: "solid", label: "Solid" },
            { value: "segments", label: "Segments" },
            { value: "gradient", label: "Gradient" },
        ] satisfies Option<BarLook>[],
    },
    needle: {
        label: "Analogue needle look",
        options: [
            { value: "classic", label: "Classic" },
            { value: "zones", label: "Zones" },
            { value: "ticks", label: "Ticks" },
        ] satisfies Option<NeedleLook>[],
    },
    waveform: {
        label: "Waveform look",
        options: [
            { value: "pill", label: "Pill" },
            { value: "pulse", label: "Pulse" },
            { value: "columns", label: "Columns" },
        ] satisfies Option<WaveformLook>[],
    },
}

const ChoiceList = <T extends string>({
    name,
    label,
    options,
    selected,
    onSelect,
}: {
    name: string
    label: string
    options: Option<T>[]
    selected: T
    onSelect(value: T): void
}) => (
    <fieldset className="md-choice">
        <legend>{label}</legend>
        <div className="md-choice-options">
            {options.map(({ value, label: optionLabel }) => (
                <label key={value} className="md-choice-option">
                    <input
                        type="radio"
                        name={name}
                        checked={selected === value}
                        onChange={(): void => onSelect(value)}
                    />
                    <span>{optionLabel}</span>
                </label>
            ))}
        </div>
    </fieldset>
)

const SettingsDialog: FC<{
    dialogRef: RefObject<HTMLDialogElement | null>
    meter: MeterChoice
    onMeterChange(meter: MeterChoice): void
    onClose(): void
}> = ({ dialogRef, meter, onMeterChange, onClose }) => {
    const looks = LOOKS[meter.style]

    return (
        <dialog
            ref={dialogRef}
            className="md-dialog"
            aria-labelledby="md-settings-title"
            // A setting can be changed while dictating, as in the app.
            data-dictation-setting
            onClose={onClose}
            onClick={(event): void => {
                // A click on the backdrop lands on the dialog element itself.
                if (event.target === event.currentTarget) {
                    dialogRef.current?.close()
                }
            }}
        >
            <div className="md-dialog-body">
                <div className="md-dialog-head">
                    <h2 id="md-settings-title">Settings</h2>
                    <button
                        type="button"
                        className="md-icon-button"
                        aria-label="Close settings"
                        onClick={(): void => dialogRef.current?.close()}
                    >
                        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>
                <p className="md-dialog-note">These choices last until the page is reloaded.</p>

                <h3 className="md-dialog-section">Dictation level meter</h3>
                <div className="md-meter-preview">
                    <LevelMeter choice={meter} readLevel={readSimulatedLevel} />
                    <span>Preview of how loud the sound reaching the microphone is.</span>
                </div>
                <ChoiceList
                    name="md-meter-style"
                    label="Style"
                    options={METER_STYLES}
                    selected={meter.style}
                    onSelect={(style): void => onMeterChange({ ...meter, style })}
                />
                <ChoiceList
                    name="md-meter-look"
                    label={looks.label}
                    options={looks.options as Option<string>[]}
                    selected={meter[meter.style]}
                    onSelect={(look): void => onMeterChange({ ...meter, [meter.style]: look })}
                />

                <div className="md-dialog-foot">
                    <button type="button" className="md-button md-button-primary" onClick={(): void => dialogRef.current?.close()}>
                        Done
                    </button>
                </div>
            </div>
        </dialog>
    )
}

/* ---------- The details panel beneath a row ---------- */

export const TaskDetails: FC<{
    task: TaskType
    today: Date
    panelId: string
    names: ReturnType<typeof getTaskControlNames>
    focusField: DetailField | null
    updateTask(id: string, changes: Partial<TaskType>): void
    deleteTask(id: string): void
    onClose(): void
}> = ({ task, today, panelId, names, focusField, updateTask, deleteTask, onClose }) => {
    const panel = useRef<HTMLDivElement>(null)
    const quickDates = getQuickDueDates(today)

    useEffect(() => {
        if (!focusField) {
            return
        }

        panel.current?.querySelector<HTMLElement>(`[data-focus="${focusField}"]`)?.focus()
        // Only when the panel opens.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <div
            ref={panel}
            id={panelId}
            className="md-details"
            role="group"
            aria-label={`Details for ${names.dictationTarget}`}
            onKeyDown={(event: KeyboardEvent<HTMLDivElement>): void => {
                if (event.key === "Escape") {
                    event.stopPropagation()
                    onClose()
                }
            }}
        >
            <div className="md-field">
                <span className="md-field-label" aria-hidden="true">
                    Due date
                </span>
                <div className="md-due-controls">
                    <input
                        type="date"
                        className="md-date"
                        data-focus="due"
                        value={task.dueDate}
                        onChange={(event): void => updateTask(task.id, { dueDate: event.target.value })}
                        aria-label={names.dueDate}
                    />
                    <div className="md-quick-dates" role="group" aria-label={`Quick due dates for ${names.dictationTarget}`}>
                        {quickDates.map(({ label, value, description }) => (
                            <button
                                key={label}
                                type="button"
                                className="md-quick-date"
                                aria-pressed={task.dueDate === value}
                                aria-label={`${label}, ${description}`}
                                title={description}
                                onClick={(): void => updateTask(task.id, { dueDate: value })}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="md-field">
                <span className="md-field-label" aria-hidden="true">
                    Priority
                </span>
                <div className="md-segmented" role="radiogroup" aria-label={names.priority}>
                    {[1, 2, 3, 4, 5].map((level) => (
                        <label key={level} className="md-segment">
                            <input
                                type="radio"
                                name={`md-priority-${task.id}`}
                                data-focus={task.priority === level ? "priority" : undefined}
                                checked={task.priority === level}
                                onChange={(): void => updateTask(task.id, { priority: level })}
                                aria-label={`${level} of 5${level === 1 ? ", lowest" : level === 5 ? ", highest" : ""}`}
                            />
                            <span aria-hidden="true">{level}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div className="md-field">
                <span className="md-field-label" aria-hidden="true">
                    Assignee
                </span>
                <div className="md-people" role="radiogroup" aria-label={names.assignee}>
                    {alphabeticalUsers.map((user) => (
                        <label key={user.id} className="md-person">
                            <input
                                type="radio"
                                name={`md-assignee-${task.id}`}
                                data-focus={task.userId === user.id ? "assignee" : undefined}
                                checked={task.userId === user.id}
                                onChange={(): void => updateTask(task.id, { userId: user.id })}
                            />
                            <Avatar user={user} />
                            <span>{user.name}</span>
                        </label>
                    ))}
                </div>
            </div>

            <button
                type="button"
                className="md-button md-button-danger"
                onClick={(): void => deleteTask(task.id)}
                aria-label={names.deleteButton}
            >
                <Icon path={ICONS.trash} />
                Delete
            </button>
        </div>
    )
}

/* ---------- A task row ---------- */

interface TaskRowProps {
    task: TaskType
    visiblePosition: number
    today: Date
    dictation: SimulatedDictation
    isExpanded: boolean
    focusField: DetailField | null
    isDragging: boolean
    registerTitle(id: string, input: HTMLTextAreaElement | null): void
    updateTask(id: string, changes: Partial<TaskType>): void
    deleteTask(id: string): void
    toggleDictation(id: string): void
    toggleDetails(id: string, field: DetailField | null): void
    onTitleBlur(event: FocusEvent<HTMLTextAreaElement>): void
    onDragStart(id: string, event: DragEvent<HTMLLIElement>): void
    onDragOver(id: string, event: DragEvent<HTMLLIElement>): void
    onDragEnd(): void
}

/** Grows a one-line text area to fit its whole title, so that long titles wrap instead of being cut off. */
const fitToContent = (area: HTMLTextAreaElement | null): void => {
    if (area) {
        area.style.height = "auto"
        // scrollHeight leaves out the border, which the height includes.
        area.style.height = `${area.scrollHeight + area.offsetHeight - area.clientHeight}px`
    }
}

const TaskRow: FC<TaskRowProps> = ({
    task,
    visiblePosition,
    today,
    dictation,
    isExpanded,
    focusField,
    isDragging,
    registerTitle,
    updateTask,
    deleteTask,
    toggleDictation,
    toggleDetails,
    onTitleBlur,
    onDragStart,
    onDragOver,
    onDragEnd,
}) => {
    // The row is draggable only while the pointer is down on its grip, so that
    // text in the title can still be selected with the mouse.
    const [isDragArmed, setIsDragArmed] = useState(false)
    const title = useRef<HTMLTextAreaElement | null>(null)
    const detailsButton = useRef<HTMLButtonElement>(null)
    const user = prototypeUsers.find((candidate) => candidate.id === task.userId)
    const names = getTaskControlNames(task.text, visiblePosition)
    const state = getTaskState(task, today)
    const status = describeDueStatus(getDaysUntilDue(task.dueDate, today), task.completed)
    const isDictating = dictation.phase !== "idle" && dictation.activeTargetId === task.id
    const panelId = `md-details-${task.id}`
    const summaryId = `md-summary-${task.id}`

    useLayoutEffect(() => fitToContent(title.current), [task.text])

    useEffect(() => {
        const refit = (): void => fitToContent(title.current)
        window.addEventListener("resize", refit)
        return () => window.removeEventListener("resize", refit)
    }, [])

    const handleSummaryClick = (event: MouseEvent<HTMLButtonElement>): void => {
        // A pointer click on one part of the summary opens the panel at that
        // field. From the keyboard, focus stays on the button, as for any
        // disclosure.
        const part = (event.target as Element).closest<HTMLElement>("[data-field]")?.dataset.field
        toggleDetails(task.id, event.detail > 0 && !isExpanded ? ((part as DetailField | undefined) ?? "due") : null)
    }

    const classes = [
        "md-row",
        `md-row-${state}`,
        isExpanded && "md-row-expanded",
        isDragging && "md-row-dragging",
        isDictating && "md-row-dictating",
    ]
        .filter(Boolean)
        .join(" ")

    return (
        <li
            className={classes}
            draggable={isDragArmed}
            onDragStart={(event): void => onDragStart(task.id, event)}
            onDragOver={(event): void => onDragOver(task.id, event)}
            onDrop={(event): void => event.preventDefault()}
            onPointerUp={(): void => setIsDragArmed(false)}
            onDragEnd={(): void => {
                setIsDragArmed(false)
                onDragEnd()
            }}
        >
            <div className="md-row-line">
                <span
                    className="md-grip md-reveal"
                    title="Drag to reorder"
                    onPointerDown={(): void => setIsDragArmed(true)}
                >
                    <Icon path={ICONS.grip} />
                </span>

                <input
                    type="checkbox"
                    className="md-check"
                    checked={task.completed}
                    onChange={(event): void => updateTask(task.id, { completed: event.target.checked })}
                    aria-label={names.completed}
                />

                <div className="md-title-cell">
                    <textarea
                        ref={(area): void => {
                            title.current = area
                            registerTitle(task.id, area)
                        }}
                        className="md-title"
                        rows={1}
                        value={task.text}
                        spellCheck={false}
                        onChange={(event): void =>
                            // Titles stay on one logical line, as in the app; they only wrap on screen.
                            updateTask(task.id, { text: event.target.value.replace(/[\r\n]+/g, " ") })
                        }
                        onKeyDown={(event): void => {
                            if (event.key === "Enter") {
                                event.preventDefault()
                            }
                        }}
                        onBlur={onTitleBlur}
                        aria-label={names.title}
                    />
                    <DictationButton
                        targetId={task.id}
                        targetName={names.dictationTarget}
                        dictation={dictation}
                        onToggle={(): void => toggleDictation(task.id)}
                    />
                </div>

                <button
                    ref={detailsButton}
                    type="button"
                    className="md-summary"
                    aria-expanded={isExpanded}
                    aria-controls={isExpanded ? panelId : undefined}
                    aria-label={`Edit details for ${names.dictationTarget}`}
                    aria-describedby={summaryId}
                    onClick={handleSummaryClick}
                >
                    <span id={summaryId} className="md-summary-parts">
                        <span className={`md-due md-due-${state}`} data-field="due">
                            <Icon path={STATE_ICONS[state]} className="md-due-icon" size={14} />
                            <span className="md-due-text">{status}</span>
                            {task.dueDate && <span className="md-due-date">{formatShortDate(task.dueDate)}</span>}
                        </span>
                        <span className="md-priority" data-field="priority">
                            <PriorityBars priority={task.priority} />
                            <span className="md-priority-number" aria-hidden="true">
                                {task.priority}
                            </span>
                            <span className="md-visually-hidden">, priority {task.priority} of 5,</span>
                        </span>
                        <span className="md-assignee" data-field="assignee">
                            <Avatar user={user} />
                            <span className="md-assignee-name">{user?.name ?? "Unassigned"}</span>
                        </span>
                    </span>
                    <Icon path={ICONS.chevron} className="md-chevron" />
                </button>
            </div>

            {isExpanded && (
                <TaskDetails
                    task={task}
                    today={today}
                    panelId={panelId}
                    names={names}
                    focusField={focusField}
                    updateTask={updateTask}
                    deleteTask={deleteTask}
                    onClose={(): void => {
                        toggleDetails(task.id, null)
                        detailsButton.current?.focus()
                    }}
                />
            )}
        </li>
    )
}

/* ---------- Sidebar ---------- */

const Sidebar: FC<{
    tasks: TaskType[]
    assigneeFilter: string
    onFilterChange(id: string): void
    settingsButton: RefObject<HTMLButtonElement | null>
    onOpenSettings(): void
}> = ({ tasks, assigneeFilter, onFilterChange, settingsButton, onOpenSettings }) => {
    const countFor = (id: string): number => tasks.filter((task) => id === "" || task.userId === id).length

    return (
        <aside className="md-sidebar">
            <div className="md-brand">
                <Icon path={ICONS.mark} size={22} className="md-brand-mark" />
                <span>Task Manager</span>
            </div>

            <nav className="md-nav" aria-labelledby="md-nav-heading">
                <h2 id="md-nav-heading" className="md-nav-heading">
                    Assignee
                </h2>
                <ul>
                    <li>
                        <button
                            type="button"
                            className="md-nav-item"
                            aria-pressed={assigneeFilter === ""}
                            onClick={(): void => onFilterChange("")}
                        >
                            <span className="md-nav-icon">
                                <Icon path={ICONS.users} />
                            </span>
                            <span className="md-nav-name">All assignees</span>
                            <span className="md-nav-count">{countFor("")}</span>
                        </button>
                    </li>
                    {alphabeticalUsers.map((user) => (
                        <li key={user.id}>
                            <button
                                type="button"
                                className="md-nav-item"
                                aria-pressed={assigneeFilter === user.id}
                                onClick={(): void => onFilterChange(user.id)}
                            >
                                <Avatar user={user} />
                                <span className="md-nav-name">{user.name}</span>
                                <span className="md-nav-count">{countFor(user.id)}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>

            <section className="md-side-card" aria-labelledby="md-dictation-heading">
                <h2 id="md-dictation-heading" className="md-nav-heading">
                    Dictation
                </h2>
                <p>
                    Dictate a task title: click its{" "}
                    <span className="md-hint-mic">
                        <MicrophoneIcon label="microphone" />
                    </span>{" "}
                    button, or click a title and press <kbd>Ctrl</kbd> + <kbd>Alt</kbd>. These both toggle the mic
                    on/off.
                </p>
                <p className="md-notice">
                    <Icon path={ICONS.info} size={14} />
                    <span>This demo may retain dictated text for diagnostics.</span>
                </p>
            </section>

            <div className="md-side-foot">
                <button
                    type="button"
                    ref={settingsButton}
                    className="md-nav-item md-nav-item-plain"
                    data-dictation-setting
                    onMouseDown={(event): void => event.preventDefault()}
                    onClick={onOpenSettings}
                >
                    <span className="md-nav-icon">
                        <Icon path={ICONS.gear} />
                    </span>
                    <span className="md-nav-name">Settings</span>
                </button>
                {/* The account area is out of scope; this only fills its place. */}
                <button type="button" className="md-nav-item md-nav-item-plain" title="Not part of the prototype">
                    <span className="md-nav-icon md-nav-icon-google" aria-hidden="true">
                        G
                    </span>
                    <span className="md-nav-name">Sign in with Google</span>
                </button>
            </div>
        </aside>
    )
}

/* ---------- Reviewer controls. Not part of the design. ---------- */

const ReviewerBar: FC<{
    availability: SimulatedAvailability
    onAvailabilityChange(value: SimulatedAvailability): void
    rowControls: RowControls
    onRowControlsChange(value: RowControls): void
}> = ({ availability, onAvailabilityChange, rowControls, onRowControlsChange }) => (
    <aside className="md-review-bar" aria-label="Prototype controls">
        <p>
            <strong>Prototype: Modern</strong> (TM #56). Sample tasks only; nothing is saved.{" "}
            <a href="../">All prototypes</a>
        </p>
        <label>
            Dictation
            <select
                value={availability}
                onChange={(event): void => onAvailabilityChange(event.target.value as SimulatedAvailability)}
            >
                <option value="available">Available (simulated)</option>
                <option value="not_configured">Not configured</option>
            </select>
        </label>
        <label>
            Grip and microphone
            <select value={rowControls} onChange={(event): void => onRowControlsChange(event.target.value as RowControls)}>
                <option value="reveal">Shown on hover and focus</option>
                <option value="always">Always shown</option>
            </select>
        </label>
    </aside>
)

/* ---------- The page ---------- */

const describeSummary = (tasks: TaskType[], today: Date): string => {
    const states = tasks.map((task) => getTaskState(task, today))
    const overdue = states.filter((state) => state === "overdue").length
    const soon = states.filter((state) => state === "due-soon").length
    const done = states.filter((state) => state === "completed").length
    const parts = [overdue && `${overdue} overdue`, soon && `${soon} due soon`, done && `${done} completed`]

    return parts.filter(Boolean).join(" · ")
}

export const ModernApp: FC = () => {
    const [today] = useState(() => new Date())
    const [tasks, setTasks] = useState<TaskType[]>(() => createPrototypeTasks(today))
    const [assigneeFilter, setAssigneeFilter] = useState("")
    const [availability, setAvailability] = useState<SimulatedAvailability>("available")
    const [rowControls, setRowControls] = useState<RowControls>("reveal")
    const [meter, setMeter] = useState<MeterChoice>({ style: "bar", bar: "solid", needle: "classic", waveform: "pill" })
    const [expanded, setExpanded] = useState<{ id: string; field: DetailField | null } | null>(null)
    const [draggedId, setDraggedId] = useState<string | null>(null)
    const dictation = useSimulatedDictation(availability)

    const titleInputs = useRef(new Map<string, HTMLTextAreaElement>())
    const settingsDialog = useRef<HTMLDialogElement>(null)
    const settingsButton = useRef<HTMLButtonElement>(null)
    const focusAfterRender = useRef<(() => void) | null>(null)
    const nextNewId = useRef(0)

    useEffect(() => {
        focusAfterRender.current?.()
        focusAfterRender.current = null
    }, [tasks])

    const visibleTasks = tasks.filter((task) => assigneeFilter === "" || task.userId === assigneeFilter)
    const filteredUser = prototypeUsers.find((user) => user.id === assigneeFilter)
    const summary = describeSummary(visibleTasks, today)

    const registerTitle = (id: string, area: HTMLTextAreaElement | null): void => {
        if (area) {
            titleInputs.current.set(id, area)
        } else {
            titleInputs.current.delete(id)
        }
    }

    const updateTask = (id: string, changes: Partial<TaskType>): void =>
        setTasks((current) => updateTaskInList(current, id, changes))

    const addTask = (): void => {
        const task: TaskType = {
            id: `p-new-${(nextNewId.current += 1)}`,
            text: "New task",
            // As in the app: the filtered assignee, or else the first user in the app's list.
            userId: assigneeFilter || prototypeUsers[0].id,
            priority: 3,
            dueDate: format(new Date(), "yyyy-MM-dd"),
            completed: false,
        }

        setTasks((current) => [...current, task])
        focusAfterRender.current = (): void => {
            titleInputs.current.get(task.id)?.focus()
            titleInputs.current.get(task.id)?.select()
        }
    }

    const deleteTask = (id: string): void => {
        if (dictation.activeTargetId === id) {
            dictation.stop("task_deleted")
        }

        // Focus would otherwise be lost with the row; send it somewhere sensible.
        const index = visibleTasks.findIndex((task) => task.id === id)
        const neighbour = visibleTasks[index + 1] ?? visibleTasks[index - 1]
        focusAfterRender.current = (): void => {
            ;(neighbour ? titleInputs.current.get(neighbour.id) : document.querySelector<HTMLElement>(".md-add"))?.focus()
        }

        setExpanded(null)
        setTasks((current) => current.filter((task) => task.id !== id))
    }

    const toggleDetails = (id: string, field: DetailField | null): void =>
        setExpanded((current) => (current?.id === id ? null : { id, field }))

    const toggleDictation = (id: string): void => {
        dictation.toggle(id)
        titleInputs.current.get(id)?.focus()
    }

    // As in the app, dictation stops when focus leaves the task titles, but
    // not when it moves to a dictation setting.
    const handleTitleBlur = (event: FocusEvent<HTMLTextAreaElement>): void => {
        const next = event.relatedTarget as Element | null
        const isTitle = next instanceof HTMLTextAreaElement && [...titleInputs.current.values()].includes(next)

        if (!isTitle && !next?.closest("[data-dictation-setting]")) {
            dictation.stop("focus")
        }
    }

    const closeSettings = (): void => {
        const activeTitle = dictation.activeTargetId ? titleInputs.current.get(dictation.activeTargetId) : undefined
        ;(activeTitle ?? settingsButton.current)?.focus()
    }

    const handleDragOver = (overId: string, event: DragEvent<HTMLLIElement>): void => {
        if (!draggedId) {
            return
        }

        event.preventDefault()

        if (overId === draggedId) {
            return
        }

        // Move once the pointer crosses the middle of the row it is over, as the app does.
        const from = tasks.findIndex((task) => task.id === draggedId)
        const to = tasks.findIndex((task) => task.id === overId)
        const box = event.currentTarget.getBoundingClientRect()
        const isPastMiddle = event.clientY - box.top > box.height / 2

        if ((from < to && isPastMiddle) || (from > to && !isPastMiddle)) {
            setTasks((current) => reorderTasks(current, from, to))
        }
    }

    return (
        <div className={`md-page md-controls-${rowControls}`}>
            <ReviewerBar
                availability={availability}
                onAvailabilityChange={setAvailability}
                rowControls={rowControls}
                onRowControlsChange={setRowControls}
            />

            <div className="md-shell">
                <Sidebar
                    tasks={tasks}
                    assigneeFilter={assigneeFilter}
                    onFilterChange={setAssigneeFilter}
                    settingsButton={settingsButton}
                    onOpenSettings={(): void => settingsDialog.current?.showModal()}
                />

                <div className="md-content">
                    <main className="md-main">
                        <header className="md-header">
                            <div>
                                <h1>{filteredUser ? `${filteredUser.name}'s tasks` : "All tasks"}</h1>
                                <p className="md-subtitle">
                                    {filteredUser
                                        ? `${visibleTasks.length} of ${tasks.length} tasks`
                                        : `${tasks.length} task${tasks.length === 1 ? "" : "s"}`}
                                    {summary && <span className="md-subtitle-summary"> · {summary}</span>}
                                </p>
                            </div>
                            <button type="button" className="md-button md-button-primary md-add" onClick={addTask}>
                                <Icon path={ICONS.plus} />
                                Add Task
                            </button>
                        </header>

                        <div className="md-columns" aria-hidden="true">
                            <span className="md-col-task">Task</span>
                            <span className="md-col-due">Due</span>
                            <span className="md-col-priority">Priority</span>
                            <span className="md-col-assignee">Assignee</span>
                        </div>

                        {visibleTasks.length === 0 ? (
                            <p className="md-empty">No tasks for {filteredUser?.name ?? "anyone"}.</p>
                        ) : (
                            <ul className="md-list" aria-label="Tasks">
                                {visibleTasks.map((task, visibleIndex) => (
                                    <TaskRow
                                        key={task.id}
                                        task={task}
                                        visiblePosition={visibleIndex + 1}
                                        today={today}
                                        dictation={dictation}
                                        isExpanded={expanded?.id === task.id}
                                        focusField={expanded?.id === task.id ? expanded.field : null}
                                        isDragging={draggedId === task.id}
                                        registerTitle={registerTitle}
                                        updateTask={updateTask}
                                        deleteTask={deleteTask}
                                        toggleDictation={toggleDictation}
                                        toggleDetails={toggleDetails}
                                        onTitleBlur={handleTitleBlur}
                                        onDragStart={(id, event): void => {
                                            event.dataTransfer.effectAllowed = "move"
                                            event.dataTransfer.setData("text/plain", id)
                                            setDraggedId(id)
                                        }}
                                        onDragOver={handleDragOver}
                                        onDragEnd={(): void => setDraggedId(null)}
                                    />
                                ))}
                            </ul>
                        )}

                        <div className="md-list-foot">
                            <button
                                type="button"
                                className="md-link"
                                onClick={(): void => {
                                    dictation.stop("task_deleted")
                                    setExpanded(null)
                                    setTasks(createPrototypeTasks(today))
                                }}
                            >
                                Reset to sample tasks
                            </button>
                        </div>

                        <DictationStatus dictation={dictation} meter={meter} />
                    </main>
                </div>
            </div>

            <SettingsDialog dialogRef={settingsDialog} meter={meter} onMeterChange={setMeter} onClose={closeSettings} />
        </div>
    )
}
