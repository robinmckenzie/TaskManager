import { useEffect, useRef, useState } from "react"
import type { ChangeEvent, DragEvent, FC, FocusEvent, RefObject } from "react"
import { format } from "date-fns"
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

/*
 * TM #56 prototype: Refined. The app's layout and controls, polished. It keeps
 * tasks in memory only and never reads or writes browser storage.
 *
 * The markup follows src/App.tsx closely on purpose, so that the visual
 * changes can be judged on their own. Class names start with `rf-` so that
 * nothing here can be mistaken for, or collide with, the app's styles.
 */

type MeterPlacement = "settings" | "inline"

const alphabeticalUsers = sortAssigneesByName(prototypeUsers)

/* Icons. Each due state has its own shape, so that state is never shown by colour alone. */

const Icon: FC<{ path: string; className?: string }> = ({ path, className }) => (
    <svg className={className} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path d={path} fill="currentColor" />
    </svg>
)

const ICONS = {
    plus: "M7.25 2.75a.75.75 0 0 1 1.5 0v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5Z",
    gear: "M6.6 1.3a.6.6 0 0 1 .6-.5h1.6a.6.6 0 0 1 .6.5l.2 1.3c.4.2.8.4 1.1.6l1.2-.5a.6.6 0 0 1 .7.3l.8 1.4a.6.6 0 0 1-.1.7l-1 .8a4.6 4.6 0 0 1 0 1.3l1 .8c.2.2.3.5.1.7l-.8 1.4a.6.6 0 0 1-.7.3l-1.2-.5c-.3.3-.7.5-1.1.6l-.2 1.3a.6.6 0 0 1-.6.5H7.2a.6.6 0 0 1-.6-.5l-.2-1.3a4.4 4.4 0 0 1-1.1-.6l-1.2.5a.6.6 0 0 1-.7-.3l-.8-1.4a.6.6 0 0 1 .1-.7l1-.8a4.6 4.6 0 0 1 0-1.3l-1-.8a.6.6 0 0 1-.1-.7l.8-1.4a.6.6 0 0 1 .7-.3l1.2.5c.3-.3.7-.5 1.1-.6l.2-1.3ZM8 10.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z",
    grip: "M5.5 3a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Zm5 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Zm-5 3.75a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Zm5 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Zm-5 3.75a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Zm5 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Z",
    trash: "M6 1.75A.75.75 0 0 1 6.75 1h2.5a.75.75 0 0 1 .75.75V3h3.25a.75.75 0 0 1 0 1.5h-.4l-.7 9.1A1.5 1.5 0 0 1 10.65 15h-5.3a1.5 1.5 0 0 1-1.5-1.4L3.15 4.5h-.4a.75.75 0 0 1 0-1.5H6V1.75ZM4.66 4.5l.69 9h5.3l.69-9H4.66Z",
    warning: "M7.13 1.5a1 1 0 0 1 1.74 0l6.5 11.5a1 1 0 0 1-.87 1.5H1.5a1 1 0 0 1-.87-1.5l6.5-11.5ZM7.25 5.5v4h1.5v-4h-1.5Zm0 5.25v1.5h1.5v-1.5h-1.5Z",
    clock: "M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1Zm0 1.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Zm.75 2v3.19l2.03 2.03-1.06 1.06L7.25 8.31V4.5h1.5Z",
    calendar: "M5 1h1.5v1.5h3V1H11v1.5h1.5A1.5 1.5 0 0 1 14 4v8.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12.5V4a1.5 1.5 0 0 1 1.5-1.5H5V1ZM3.5 6.5v6h9v-6h-9Z",
    check: "M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1Zm3.03 4.47a.75.75 0 0 0-1.06 0L7 8.44 6.03 7.47a.75.75 0 1 0-1.06 1.06l1.5 1.5a.75.75 0 0 0 1.06 0l3.5-3.5a.75.75 0 0 0 0-1.06Z",
    info: "M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1Zm-.75 6v4.5h1.5V7h-1.5Zm0-2.5V6h1.5V4.5h-1.5Z",
}

/** The icon for each state, or none for due later, whose plain pill is its shape. */
const STATE_ICONS: Record<TaskState, string | null> = {
    overdue: ICONS.warning,
    "due-soon": ICONS.clock,
    "due-this-week": ICONS.calendar,
    "due-later": null,
    "no-due-date": null,
    completed: ICONS.check,
}

/* Assignee photo, with the initials behind it in case the photo cannot load. */

const Avatar: FC<{ user: PrototypeUser | undefined }> = ({ user }) => {
    const [failed, setFailed] = useState(false)

    return (
        <span className="rf-avatar">
            <span className="rf-avatar-initials" aria-hidden="true">
                {user?.initials ?? "?"}
            </span>
            {user && !failed && (
                <img
                    src={user.photo}
                    alt={user.name}
                    draggable={false}
                    onError={(): void => setFailed(true)}
                />
            )}
            {(!user || failed) && <span className="rf-visually-hidden">{user?.name ?? "Unassigned"}</span>}
        </span>
    )
}

/* Dictation. The controls follow the app's; only the look changes. */

const DictationHint: FC = () => (
    <p className="rf-dictation-hint">
        <span>
            Dictate a task title: click its{" "}
            <span className="rf-hint-mic">
                <MicrophoneIcon label="microphone" />
            </span>{" "}
            button,
        </span>{" "}
        <span>
            or click a title and press <kbd>Ctrl</kbd> + <kbd>Alt</kbd>.
        </span>
        <br />
        These both toggle the mic on/off.
    </p>
)

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
    const phaseClass = isActive ? ` rf-dictation-button-${dictation.phase}` : ""

    return (
        <button
            type="button"
            className={`rf-dictation-button${phaseClass}`}
            aria-pressed={isActive}
            aria-disabled={isAvailable ? undefined : true}
            aria-label={`${isActive ? "Stop" : "Start"} dictation into ${targetName}`}
            title={getDictationButtonTitle(dictation, isActive)}
            onMouseDown={(event): void => event.preventDefault()}
            onClick={onToggle}
        >
            <MicrophoneIcon />
        </button>
    )
}

const DictationStatus: FC<{ dictation: SimulatedDictation; meter: MeterChoice }> = ({ dictation, meter }) => {
    const { phase, message } = dictation
    const stateText = describeDictationPhase(phase)
    const isEmpty = !stateText && !message

    return (
        <div className="rf-dictation-feedback">
            <div className={`rf-status-box${isEmpty ? " rf-status-box-empty" : ""}`}>
                <p className="rf-status-text" role="status">
                    {stateText && <strong className={`rf-dictation-state rf-dictation-state-${phase}`}>{stateText}</strong>}
                    {stateText && message && " "}
                    {message}
                </p>
                {phase === "listening" && <LevelMeter choice={meter} readLevel={dictation.readAudioLevel} />}
            </div>
        </div>
    )
}

/* The level meter choice: the same buttons as the app, in either placement. */

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

const OptionButtons = <T extends string>({
    options,
    selected,
    onSelect,
}: {
    options: Option<T>[]
    selected: T
    onSelect(value: T): void
}) =>
    options.map(({ value, label }) => (
        <button
            key={value}
            type="button"
            className="rf-segment"
            aria-pressed={selected === value}
            onClick={(): void => onSelect(value)}
        >
            {label}
        </button>
    ))

const MeterStyleSelector: FC<{
    meter: MeterChoice
    onChange(meter: MeterChoice): void
    labelId: string
    variant: "inline" | "dialog"
}> = ({ meter, onChange, labelId, variant }) => {
    const looks = LOOKS[meter.style]

    return (
        <div
            className={`rf-meter-style rf-meter-style-${variant}`}
            data-dictation-setting
            // As in the app, keep focus, and the cursor, in the task title.
            onMouseDown={variant === "inline" ? (event): void => event.preventDefault() : undefined}
        >
            <div className="rf-meter-row" role="group" aria-labelledby={labelId}>
                <span id={labelId} className="rf-meter-label">
                    Level meter
                </span>
                <span className="rf-segments">
                    <OptionButtons
                        options={METER_STYLES}
                        selected={meter.style}
                        onSelect={(style): void => onChange({ ...meter, style })}
                    />
                </span>
            </div>
            <div className="rf-meter-row" role="group" aria-label={looks.label}>
                <span className="rf-meter-label" aria-hidden="true">
                    Look
                </span>
                <span className="rf-segments rf-segments-looks">
                    <OptionButtons
                        options={looks.options as Option<string>[]}
                        selected={meter[meter.style]}
                        onSelect={(look): void => onChange({ ...meter, [meter.style]: look })}
                    />
                </span>
            </div>
        </div>
    )
}

/* Settings, for preferences that are seldom changed. A proposal, not an approved change. */

const SettingsDialog: FC<{
    dialogRef: RefObject<HTMLDialogElement | null>
    meter: MeterChoice
    onMeterChange(meter: MeterChoice): void
    onClose(): void
}> = ({ dialogRef, meter, onMeterChange, onClose }) => (
    <dialog
        ref={dialogRef}
        className="rf-dialog"
        aria-labelledby="rf-settings-title"
        // A setting can be changed while dictating, as in the app.
        data-dictation-setting
        onClose={onClose}
        onClick={(event): void => {
            // A click on the backdrop lands on the dialog itself.
            if (event.target === event.currentTarget) {
                dialogRef.current?.close()
            }
        }}
    >
        <div className="rf-dialog-body">
            <header className="rf-dialog-header">
                <h2 id="rf-settings-title">Settings</h2>
                <p>These choices last until the page is reloaded.</p>
            </header>

            <section className="rf-dialog-section" aria-labelledby="rf-settings-dictation">
                <h3 id="rf-settings-dictation">Dictation</h3>
                <MeterStyleSelector
                    meter={meter}
                    onChange={onMeterChange}
                    labelId="rf-meter-label-dialog"
                    variant="dialog"
                />
                <div className="rf-meter-preview">
                    <span className="rf-meter-preview-label">Preview</span>
                    <LevelMeter choice={meter} readLevel={readSimulatedLevel} />
                    <span className="rf-meter-preview-note">
                        The meter shows how loud the sound reaching the microphone is.
                    </span>
                </div>
            </section>

            <footer className="rf-dialog-footer">
                <button type="button" className="rf-button rf-button-primary" onClick={(): void => dialogRef.current?.close()}>
                    Done
                </button>
            </footer>
        </div>
    </dialog>
)

/* A task card. */

interface TaskCardProps {
    task: TaskType
    visiblePosition: number
    today: Date
    dictation: SimulatedDictation
    isDragging: boolean
    registerTitle(id: string, input: HTMLInputElement | null): void
    updateTask(id: string, changes: Partial<TaskType>): void
    deleteTask(id: string): void
    toggleDictation(id: string): void
    onTitleBlur(event: FocusEvent<HTMLInputElement>): void
    onDragStart(id: string, event: DragEvent<HTMLDivElement>): void
    onDragOver(id: string, event: DragEvent<HTMLDivElement>): void
    onDragEnd(): void
}

const TaskCard: FC<TaskCardProps> = ({
    task,
    visiblePosition,
    today,
    dictation,
    isDragging,
    registerTitle,
    updateTask,
    deleteTask,
    toggleDictation,
    onTitleBlur,
    onDragStart,
    onDragOver,
    onDragEnd,
}) => {
    // The card is draggable only while the pointer is down on its grip, so
    // that text in its inputs can still be selected with the mouse.
    const [isDragArmed, setIsDragArmed] = useState(false)
    const user = prototypeUsers.find((candidate) => candidate.id === task.userId)
    const names = getTaskControlNames(task.text, visiblePosition)
    const state = getTaskState(task, today)
    const statusIcon = STATE_ICONS[state]
    const isDictating = dictation.phase !== "idle" && dictation.activeTargetId === task.id

    return (
        <div
            className={`rf-task rf-task-${state}${isDragging ? " rf-task-dragging" : ""}${isDictating ? " rf-task-dictating" : ""}`}
            draggable={isDragArmed}
            onDragStart={(event): void => onDragStart(task.id, event)}
            onDragOver={(event): void => onDragOver(task.id, event)}
            onDrop={(event): void => event.preventDefault()}
            // Released without dragging, anywhere on the card.
            onPointerUp={(): void => setIsDragArmed(false)}
            onDragEnd={(): void => {
                setIsDragArmed(false)
                onDragEnd()
            }}
        >
            <div
                className="rf-task-grip"
                onPointerDown={(): void => setIsDragArmed(true)}
            >
                <span className="rf-drag-handle" title="Drag to reorder">
                    <Icon path={ICONS.grip} />
                </span>
                <Avatar user={user} />
            </div>

            <div className="rf-task-main">
                <div className="rf-task-title-row">
                    <input
                        type="text"
                        ref={(input): void => registerTitle(task.id, input)}
                        className="rf-task-title"
                        value={task.text}
                        onChange={(event: ChangeEvent<HTMLInputElement>): void =>
                            updateTask(task.id, { text: event.target.value })
                        }
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

                <div className="rf-task-details">
                    <label className="rf-due">
                        <span className="rf-due-label">Due</span>
                        <input
                            type="date"
                            className="rf-input rf-date"
                            value={task.dueDate}
                            onChange={(event): void => updateTask(task.id, { dueDate: event.target.value })}
                            aria-label={names.dueDate}
                        />
                    </label>
                    <span className={`rf-state rf-state-${state}`}>
                        {statusIcon && <Icon path={statusIcon} className="rf-state-icon" />}
                        {describeDueStatus(getDaysUntilDue(task.dueDate, today), task.completed)}
                    </span>
                </div>
            </div>

            <div className="rf-task-controls">
                <label className="rf-priority">
                    <span className="rf-priority-text">
                        Priority <span className="rf-priority-value">{task.priority}</span>/5
                    </span>
                    <input
                        type="range"
                        min="1"
                        max="5"
                        step="1"
                        value={task.priority}
                        onChange={(event): void => updateTask(task.id, { priority: Number(event.target.value) })}
                        aria-label={names.priority}
                        aria-valuetext={`${task.priority} of 5`}
                    />
                </label>

                <select
                    className="rf-input rf-select"
                    value={task.userId}
                    onChange={(event): void => updateTask(task.id, { userId: event.target.value })}
                    aria-label={names.assignee}
                >
                    {alphabeticalUsers.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                            {candidate.name}
                        </option>
                    ))}
                </select>

                <label className="rf-complete">
                    <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={(event): void => updateTask(task.id, { completed: event.target.checked })}
                        aria-label={names.completed}
                    />
                    Complete
                </label>

                <button
                    type="button"
                    className="rf-button rf-button-danger-quiet"
                    onClick={(): void => deleteTask(task.id)}
                    aria-label={names.deleteButton}
                >
                    <Icon path={ICONS.trash} />
                    Delete
                </button>
            </div>
        </div>
    )
}

/* The reviewer's controls. Not part of the design. */

const PrototypeBar: FC<{
    availability: SimulatedAvailability
    onAvailabilityChange(value: SimulatedAvailability): void
    placement: MeterPlacement
    onPlacementChange(value: MeterPlacement): void
}> = ({ availability, onAvailabilityChange, placement, onPlacementChange }) => (
    <aside className="rf-proto-bar" aria-label="Prototype controls">
        <p className="rf-proto-title">
            <strong>Prototype: Refined</strong> (TM #56). Sample tasks only; nothing is saved.{" "}
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
        <fieldset>
            <legend>Level meter choice</legend>
            <label>
                <input
                    type="radio"
                    name="rf-placement"
                    checked={placement === "settings"}
                    onChange={(): void => onPlacementChange("settings")}
                />
                In Settings
            </label>
            <label>
                <input
                    type="radio"
                    name="rf-placement"
                    checked={placement === "inline"}
                    onChange={(): void => onPlacementChange("inline")}
                />
                Above the list, as now
            </label>
        </fieldset>
    </aside>
)

export const RefinedApp: FC = () => {
    const [today] = useState(() => new Date())
    const [tasks, setTasks] = useState<TaskType[]>(() => createPrototypeTasks(today))
    const [assigneeFilter, setAssigneeFilter] = useState("")
    const [availability, setAvailability] = useState<SimulatedAvailability>("available")
    const [placement, setPlacement] = useState<MeterPlacement>("settings")
    const [meter, setMeter] = useState<MeterChoice>({ style: "bar", bar: "solid", needle: "classic", waveform: "pill" })
    const [draggedId, setDraggedId] = useState<string | null>(null)
    const dictation = useSimulatedDictation(availability)

    const titleInputs = useRef(new Map<string, HTMLInputElement>())
    const settingsDialog = useRef<HTMLDialogElement>(null)
    const settingsButton = useRef<HTMLButtonElement>(null)
    const focusAfterRender = useRef<(() => void) | null>(null)

    useEffect(() => {
        focusAfterRender.current?.()
        focusAfterRender.current = null
    }, [tasks])

    const visibleTasks = tasks.filter((task) => assigneeFilter === "" || task.userId === assigneeFilter)

    const registerTitle = (id: string, input: HTMLInputElement | null): void => {
        if (input) {
            titleInputs.current.set(id, input)
        } else {
            titleInputs.current.delete(id)
        }
    }

    const updateTask = (id: string, changes: Partial<TaskType>): void =>
        setTasks((current) => current.map((task) => (task.id === id ? { ...task, ...changes } : task)))

    const addTask = (): void => {
        const task: TaskType = {
            id: `p-new-${Date.now()}`,
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

        setTasks((current) => current.filter((task) => task.id !== id))
    }

    const toggleDictation = (id: string): void => {
        dictation.toggle(id)
        titleInputs.current.get(id)?.focus()
    }

    // As in the app, dictation stops when focus leaves the task titles, but
    // not when it moves to a dictation setting.
    const handleTitleBlur = (event: FocusEvent<HTMLInputElement>): void => {
        const next = event.relatedTarget as Element | null
        const isTitle = next instanceof HTMLInputElement && [...titleInputs.current.values()].includes(next)

        if (!isTitle && !next?.closest("[data-dictation-setting]")) {
            dictation.stop("focus")
        }
    }

    const closeSettings = (): void => {
        // Back to the title being dictated into, or else to the Settings button.
        const activeTitle = dictation.activeTargetId ? titleInputs.current.get(dictation.activeTargetId) : undefined
        ;(activeTitle ?? settingsButton.current)?.focus()
    }

    const handleDragOver = (overId: string, event: DragEvent<HTMLDivElement>): void => {
        if (!draggedId) {
            return
        }

        event.preventDefault()

        if (overId === draggedId) {
            return
        }

        // Move only once the pointer has crossed the middle of the task it is
        // over, as the app does, so that the list does not jump about.
        const from = tasks.findIndex((task) => task.id === draggedId)
        const to = tasks.findIndex((task) => task.id === overId)
        const box = event.currentTarget.getBoundingClientRect()
        const isPastMiddle = event.clientY - box.top > box.height / 2

        if ((from < to && isPastMiddle) || (from > to && !isPastMiddle)) {
            setTasks((current) => reorderTasks(current, from, to))
        }
    }

    return (
        <div className="rf-page">
            <PrototypeBar
                availability={availability}
                onAvailabilityChange={setAvailability}
                placement={placement}
                onPlacementChange={setPlacement}
            />

            <main className="rf-app">
                {/* The account area is out of scope; this only fills its place. */}
                <div className="rf-account-bar">
                    <button type="button" className="rf-button rf-button-secondary" title="Not part of the prototype">
                        Sign in with Google
                    </button>
                </div>

                <header className="rf-header">
                    <div className="rf-heading">
                        <h1>Task Manager</h1>
                        <p className="rf-count">
                            {tasks.length} task{tasks.length === 1 ? "" : "s"}
                        </p>
                    </div>

                    <DictationHint />

                    <div className="rf-header-actions">
                        {placement === "settings" && (
                            <button
                                type="button"
                                ref={settingsButton}
                                className="rf-button rf-button-secondary"
                                data-dictation-setting
                                onMouseDown={(event): void => event.preventDefault()}
                                onClick={(): void => settingsDialog.current?.showModal()}
                            >
                                <Icon path={ICONS.gear} />
                                Settings
                            </button>
                        )}
                        <button type="button" className="rf-button rf-button-primary" onClick={addTask}>
                            <Icon path={ICONS.plus} />
                            Add Task
                        </button>
                    </div>
                </header>

                <section className={`rf-task-list rf-meter-${placement}`} aria-label="Tasks">
                    <div className="rf-list-controls">
                        <label className="rf-filter">
                            Assignee
                            <select
                                className="rf-input rf-select"
                                value={assigneeFilter}
                                onChange={(event): void => setAssigneeFilter(event.target.value)}
                            >
                                <option value="">All assignees</option>
                                {alphabeticalUsers.map((user) => (
                                    <option key={user.id} value={user.id}>
                                        {user.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <DictationStatus dictation={dictation} meter={meter} />

                        <p className="rf-notice">
                            <Icon path={ICONS.info} />
                            This demo may retain dictated text for diagnostics.
                        </p>

                        {placement === "inline" && (
                            <MeterStyleSelector
                                meter={meter}
                                onChange={setMeter}
                                labelId="rf-meter-label-inline"
                                variant="inline"
                            />
                        )}
                    </div>

                    {visibleTasks.map((task, visibleIndex) => (
                        <TaskCard
                            key={task.id}
                            task={task}
                            visiblePosition={visibleIndex + 1}
                            today={today}
                            dictation={dictation}
                            isDragging={draggedId === task.id}
                            registerTitle={registerTitle}
                            updateTask={updateTask}
                            deleteTask={deleteTask}
                            toggleDictation={toggleDictation}
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

                    <button
                        type="button"
                        className="rf-reset"
                        onClick={(): void => {
                            dictation.stop("task_deleted")
                            setTasks(createPrototypeTasks(today))
                        }}
                    >
                        Reset to sample tasks
                    </button>
                </section>
            </main>

            <SettingsDialog
                dialogRef={settingsDialog}
                meter={meter}
                onMeterChange={setMeter}
                onClose={closeSettings}
            />
        </div>
    )
}
