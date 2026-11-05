import { useEffect, useLayoutEffect, useRef, useState } from "react"
import type { DragEvent, FC, FocusEvent, KeyboardEvent, MouseEvent, RefObject } from "react"
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
import { createPrototypeTasks, prototypeUsers } from "../sampleTasks"
import type { PrototypeUser } from "../sampleTasks"
import { readSimulatedLevel, useSimulatedDictation } from "../simulatedDictation"
import type { SimulatedAvailability, SimulatedDictation } from "../simulatedDictation"
import { describeCountdown, formatDueDate, getQuickDueDates } from "./docket"

/*
 * TM #56 prototype: Distinctive ("Docket"). The list is a ledger of entries,
 * each led by a countdown block that shows how many days are left or overdue.
 * Titles get the full width. One task at a time is selected, and its due
 * date, priority and assignee are edited in a dock fixed to the foot of the
 * window, which also holds the dictation status and the level meter choice.
 * Tasks are kept in memory only, and browser storage is never read or written.
 *
 * Class names start with `dk-`. Nothing here is shared with Refined or Modern
 * apart from the sample data and the simulated dictation.
 */

/** Which dock field a pointer click on part of an entry should focus. */
type DockField = "due" | "priority" | "assignee"

const alphabeticalUsers = sortAssigneesByName(prototypeUsers)

/* ---------- Icons ---------- */

const Icon: FC<{ path: string; className?: string; size?: number }> = ({ path, className, size = 16 }) => (
    <svg className={className} viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
        <path d={path} fill="currentColor" />
    </svg>
)

const ICONS = {
    plus: "M7.25 2.75a.75.75 0 0 1 1.5 0v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5Z",
    grip: "M6 3a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm4 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2ZM6 7a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm4 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm-4 4a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm4 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z",
    trash: "M6 1.75A.75.75 0 0 1 6.75 1h2.5a.75.75 0 0 1 .75.75V3h3.25a.75.75 0 0 1 0 1.5h-.4l-.7 9.1A1.5 1.5 0 0 1 10.65 15h-5.3a1.5 1.5 0 0 1-1.5-1.4L3.15 4.5h-.4a.75.75 0 0 1 0-1.5H6V1.75ZM4.66 4.5l.69 9h5.3l.69-9H4.66Z",
    info: "M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1Zm-.75 6v4.5h1.5V7h-1.5Zm0-2.5V6h1.5V4.5h-1.5Z",
    tick: "M13.53 3.97a.75.75 0 0 1 0 1.06l-7 7a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 1 1 1.06-1.06L6 10.44l6.47-6.47a.75.75 0 0 1 1.06 0Z",
    caret: "M4.22 9.78a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 1 1-1.06 1.06L8 7.06 5.28 9.78a.75.75 0 0 1-1.06 0Z",
    pencil: "M11.3 1.7a1.5 1.5 0 0 1 2.1 0l.9.9a1.5 1.5 0 0 1 0 2.1l-8.1 8.1-3.4.9a.6.6 0 0 1-.7-.7l.9-3.4 8.3-7.9Zm1 1.1L4.4 10.6l-.4 1.4 1.4-.4 7.9-7.9-1-.9Z",
}

/* ---------- Small pieces ---------- */

const Avatar: FC<{ user: PrototypeUser | undefined; size?: "sm" | "md" }> = ({ user, size = "sm" }) => {
    const [failed, setFailed] = useState(false)

    return (
        <span className={`dk-avatar dk-avatar-${size}`} aria-hidden="true">
            <span className="dk-avatar-initials">{user?.initials ?? "?"}</span>
            {user && !failed && (
                <img src={user.photo} alt="" draggable={false} onError={(): void => setFailed(true)} />
            )}
        </span>
    )
}

/** Five squares, filled up to the priority. The number beside them carries the value too. */
const PriorityPips: FC<{ priority: number }> = ({ priority }) => (
    <span className="dk-pips" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((level) => (
            <span key={level} className={level <= priority ? "dk-pip dk-pip-on" : "dk-pip"} />
        ))}
    </span>
)

/** The block that leads each entry: a label, a big figure and a unit. Read out through the entry's status text instead. */
const CountdownBlock: FC<{ task: TaskType; today: Date }> = ({ task, today }) => {
    const { state, label, figure, unit } = describeCountdown(task, today)

    return (
        <span className={`dk-count dk-count-${state}`} aria-hidden="true">
            <span className="dk-count-label">{label}</span>
            {state === "completed" ? (
                <Icon path={ICONS.tick} className="dk-count-tick" size={26} />
            ) : (
                <span className={`dk-count-figure${figure.length > 2 ? " dk-count-word" : ""}`}>{figure}</span>
            )}
            {unit && <span className="dk-count-unit">{unit}</span>}
        </span>
    )
}

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
            className={`dk-mic${isActive ? ` dk-mic-active dk-mic-${dictation.phase}` : ""}`}
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

/* ---------- Level meter choice, beside the dictation status ---------- */

interface Option<T> {
    value: T
    label: string
}

const METER_STYLES: Option<MeterStyle>[] = [
    { value: "bar", label: "Horizontal bar" },
    { value: "needle", label: "Analogue needle" },
    { value: "waveform", label: "Waveform" },
]

const LOOKS: { [S in MeterStyle]: Option<MeterChoice[S]>[] } = {
    bar: [
        { value: "solid", label: "Solid" },
        { value: "segments", label: "Segments" },
        { value: "gradient", label: "Gradient" },
    ] satisfies Option<BarLook>[],
    needle: [
        { value: "classic", label: "Classic" },
        { value: "zones", label: "Zones" },
        { value: "ticks", label: "Ticks" },
    ] satisfies Option<NeedleLook>[],
    waveform: [
        { value: "pill", label: "Pill" },
        { value: "pulse", label: "Pulse" },
        { value: "columns", label: "Columns" },
    ] satisfies Option<WaveformLook>[],
}

const describeMeter = (meter: MeterChoice): string => {
    const style = METER_STYLES.find((option) => option.value === meter.style)?.label ?? ""
    const look = (LOOKS[meter.style] as Option<string>[]).find((option) => option.value === meter[meter.style])?.label

    return `${style}, ${look?.toLowerCase() ?? ""}`
}

/**
 * Toggle buttons, as the app's meter selector has. They keep focus where it
 * is on a mouse click, so choosing a meter while dictating leaves the cursor
 * in the title.
 */
const ToggleRow = <T extends string>({
    label,
    options,
    selected,
    onSelect,
}: {
    label: string
    options: Option<T>[]
    selected: T
    onSelect(value: T): void
}) => (
    <div className="dk-toggle-row" role="group" aria-label={label}>
        <span className="dk-toggle-label" aria-hidden="true">
            {label}
        </span>
        {options.map(({ value, label: optionLabel }) => (
            <button
                key={value}
                type="button"
                className="dk-toggle"
                aria-pressed={selected === value}
                onMouseDown={(event): void => event.preventDefault()}
                onClick={(): void => onSelect(value)}
            >
                {optionLabel}
            </button>
        ))}
    </div>
)

const MeterChooser: FC<{ meter: MeterChoice; onMeterChange(meter: MeterChoice): void }> = ({ meter, onMeterChange }) => {
    const [isOpen, setIsOpen] = useState(false)
    const wrapper = useRef<HTMLDivElement>(null)
    const button = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        if (!isOpen) {
            return
        }

        const closeOnOutsidePointer = (event: PointerEvent): void => {
            if (!wrapper.current?.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        document.addEventListener("pointerdown", closeOnOutsidePointer)
        return () => document.removeEventListener("pointerdown", closeOnOutsidePointer)
    }, [isOpen])

    return (
        <div
            ref={wrapper}
            className="dk-meter-chooser"
            // A setting can be changed while dictating, as in the app.
            data-dictation-setting
            onKeyDown={(event: KeyboardEvent<HTMLDivElement>): void => {
                if (event.key === "Escape" && isOpen) {
                    event.stopPropagation()
                    setIsOpen(false)
                    button.current?.focus()
                }
            }}
        >
            <button
                ref={button}
                type="button"
                className="dk-meter-button"
                aria-expanded={isOpen}
                aria-controls="dk-meter-panel"
                onMouseDown={(event): void => event.preventDefault()}
                onClick={(): void => setIsOpen((open) => !open)}
            >
                <span className="dk-meter-button-label">Level meter:</span> {describeMeter(meter)}
                <Icon path={ICONS.caret} className={isOpen ? "dk-caret dk-caret-open" : "dk-caret"} size={14} />
            </button>
            <div id="dk-meter-panel" className="dk-meter-panel" role="group" aria-label="Level meter" hidden={!isOpen}>
                <div className="dk-meter-preview">
                    <LevelMeter choice={meter} readLevel={readSimulatedLevel} />
                    <span>Preview. Shown while listening, to say how loud the sound reaching the microphone is.</span>
                </div>
                <ToggleRow
                    label="Style"
                    options={METER_STYLES}
                    selected={meter.style}
                    onSelect={(style): void => onMeterChange({ ...meter, style })}
                />
                <ToggleRow
                    label="Look"
                    options={LOOKS[meter.style] as Option<string>[]}
                    selected={meter[meter.style]}
                    onSelect={(look): void => onMeterChange({ ...meter, [meter.style]: look })}
                />
            </div>
        </div>
    )
}

/** The dock's lower line: the live dictation status, the retention notice and the meter choice. */
const DictationLine: FC<{
    dictation: SimulatedDictation
    meter: MeterChoice
    onMeterChange(meter: MeterChoice): void
}> = ({ dictation, meter, onMeterChange }) => {
    const { phase, message } = dictation
    const stateText = describeDictationPhase(phase)

    return (
        <div className="dk-dictation-line">
            <div className={`dk-status dk-status-${phase}`}>
                <span className="dk-status-mic" aria-hidden="true">
                    <MicrophoneIcon />
                </span>
                <p className="dk-status-text" role="status">
                    {stateText && <strong>{stateText}</strong>}
                    {stateText && message && " "}
                    {message}
                </p>
                {phase === "listening" && (
                    <span className="dk-status-meter">
                        <LevelMeter choice={meter} readLevel={dictation.readAudioLevel} />
                    </span>
                )}
            </div>
            <p className="dk-notice">
                <Icon path={ICONS.info} size={14} />
                <span>This demo may retain dictated text for diagnostics.</span>
            </p>
            <MeterChooser meter={meter} onMeterChange={onMeterChange} />
        </div>
    )
}

/* ---------- The editing dock ---------- */

interface DockProps {
    task: TaskType | undefined
    visiblePosition: number
    today: Date
    focusRequest: { field: DockField; count: number } | null
    dictation: SimulatedDictation
    meter: MeterChoice
    onMeterChange(meter: MeterChoice): void
    updateTask(id: string, changes: Partial<TaskType>): void
    deleteTask(id: string): void
    onEscape(): void
}

const Dock: FC<DockProps> = ({
    task,
    visiblePosition,
    today,
    focusRequest,
    dictation,
    meter,
    onMeterChange,
    updateTask,
    deleteTask,
    onEscape,
}) => {
    const editor = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (focusRequest) {
            editor.current?.querySelector<HTMLElement>(`[data-focus="${focusRequest.field}"]`)?.focus()
        }
    }, [focusRequest])

    const names = task ? getTaskControlNames(task.text, visiblePosition) : null
    const quickDates = getQuickDueDates(today)

    return (
        <section className="dk-dock" aria-labelledby="dk-dock-heading">
            <div className="dk-dock-inner">
                {task && names ? (
                    <div
                        ref={editor}
                        className="dk-editor"
                        onKeyDown={(event: KeyboardEvent<HTMLDivElement>): void => {
                            if (event.key === "Escape") {
                                event.stopPropagation()
                                onEscape()
                            }
                        }}
                    >
                        <div className="dk-editor-head">
                            <h2 id="dk-dock-heading" className="dk-editor-heading">
                                <span className="dk-small-caps">Editing</span>
                                <span className="dk-editor-title" title={task.text}>
                                    {names.dictationTarget}
                                </span>
                            </h2>
                            <button
                                type="button"
                                className="dk-button dk-button-danger"
                                onClick={(): void => deleteTask(task.id)}
                                aria-label={names.deleteButton}
                            >
                                <Icon path={ICONS.trash} />
                                Delete
                            </button>
                        </div>

                        <div className="dk-fields">
                            <div className="dk-field dk-field-due" role="group" aria-label={names.dueDate}>
                                <span className="dk-field-label dk-small-caps" aria-hidden="true">
                                    Due
                                </span>
                                <div className="dk-field-controls">
                                    {quickDates.map(({ label, value }) => (
                                        <button
                                            key={label}
                                            type="button"
                                            className="dk-chip"
                                            aria-pressed={task.dueDate === value}
                                            title={formatDueDate(value, today)}
                                            onClick={(): void => updateTask(task.id, { dueDate: value })}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                    <input
                                        type="date"
                                        className="dk-date"
                                        data-focus="due"
                                        value={task.dueDate}
                                        onChange={(event): void => updateTask(task.id, { dueDate: event.target.value })}
                                        aria-label={names.dueDate}
                                    />
                                    <button
                                        type="button"
                                        className="dk-chip"
                                        aria-pressed={task.dueDate === ""}
                                        onClick={(): void => updateTask(task.id, { dueDate: "" })}
                                    >
                                        No date
                                    </button>
                                </div>
                            </div>

                            <div className="dk-field">
                                <span className="dk-field-label dk-small-caps" aria-hidden="true">
                                    Priority
                                </span>
                                <div className="dk-field-controls dk-priority" role="radiogroup" aria-label={names.priority}>
                                    <span className="dk-scale-end" aria-hidden="true">
                                        low
                                    </span>
                                    {[1, 2, 3, 4, 5].map((level) => (
                                        <label key={level} className="dk-segment">
                                            <input
                                                type="radio"
                                                name="dk-priority"
                                                data-focus={task.priority === level ? "priority" : undefined}
                                                checked={task.priority === level}
                                                onChange={(): void => updateTask(task.id, { priority: level })}
                                                aria-label={`${level} of 5${level === 1 ? ", lowest" : level === 5 ? ", highest" : ""}`}
                                            />
                                            <span aria-hidden="true">{level}</span>
                                        </label>
                                    ))}
                                    <span className="dk-scale-end" aria-hidden="true">
                                        high
                                    </span>
                                </div>
                            </div>

                            <div className="dk-field">
                                <span className="dk-field-label dk-small-caps" aria-hidden="true">
                                    Assignee
                                </span>
                                <div className="dk-field-controls dk-people" role="radiogroup" aria-label={names.assignee}>
                                    {alphabeticalUsers.map((user) => (
                                        <label key={user.id} className="dk-person" title={user.name}>
                                            <input
                                                type="radio"
                                                name="dk-assignee"
                                                data-focus={task.userId === user.id ? "assignee" : undefined}
                                                checked={task.userId === user.id}
                                                onChange={(): void => updateTask(task.id, { userId: user.id })}
                                                aria-label={user.name}
                                            />
                                            <Avatar user={user} />
                                            <span className="dk-person-name" aria-hidden="true">
                                                {user.name}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <h2 id="dk-dock-heading" className="dk-editor-empty">
                        No task selected. Add a task, or choose another assignee.
                    </h2>
                )}

                <DictationLine dictation={dictation} meter={meter} onMeterChange={onMeterChange} />
            </div>
        </section>
    )
}

/* ---------- One entry in the list ---------- */

interface EntryProps {
    task: TaskType
    visiblePosition: number
    today: Date
    dictation: SimulatedDictation
    isSelected: boolean
    isDragging: boolean
    registerTitle(id: string, area: HTMLTextAreaElement | null): void
    registerEditButton(id: string, button: HTMLButtonElement | null): void
    selectTask(id: string, field?: DockField): void
    updateTask(id: string, changes: Partial<TaskType>): void
    toggleDictation(id: string): void
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

const Entry: FC<EntryProps> = ({
    task,
    visiblePosition,
    today,
    dictation,
    isSelected,
    isDragging,
    registerTitle,
    registerEditButton,
    selectTask,
    updateTask,
    toggleDictation,
    onTitleBlur,
    onDragStart,
    onDragOver,
    onDragEnd,
}) => {
    // The entry is draggable only while the pointer is down on its grip, so
    // that text in the title can still be selected with the mouse.
    const [isDragArmed, setIsDragArmed] = useState(false)
    const title = useRef<HTMLTextAreaElement | null>(null)
    const user = prototypeUsers.find((candidate) => candidate.id === task.userId)
    const names = getTaskControlNames(task.text, visiblePosition)
    const { state } = describeCountdown(task, today)
    const status = describeDueStatus(getDaysUntilDue(task.dueDate, today), task.completed)
    const dueDate = formatDueDate(task.dueDate, today)
    const isDictating = dictation.phase !== "idle" && dictation.activeTargetId === task.id
    const metaId = `dk-meta-${task.id}`

    useLayoutEffect(() => fitToContent(title.current), [task.text])

    useEffect(() => {
        const refit = (): void => fitToContent(title.current)
        window.addEventListener("resize", refit)
        return () => window.removeEventListener("resize", refit)
    }, [])

    // A pointer click on the countdown, the priority or the assignee selects
    // the entry and focuses that field in the dock. A click anywhere else that
    // is not a control just selects it.
    const handleClick = (event: MouseEvent<HTMLLIElement>): void => {
        const target = event.target as Element
        const field = target.closest<HTMLElement>("[data-field]")?.dataset.field as DockField | undefined

        if (field && event.detail > 0) {
            selectTask(task.id, field)
        } else if (!target.closest("input, textarea, button, label")) {
            selectTask(task.id)
        }
    }

    const classes = [
        "dk-entry",
        `dk-entry-${state}`,
        isSelected && "dk-entry-selected",
        isDragging && "dk-entry-dragging",
        isDictating && "dk-entry-dictating",
    ]
        .filter(Boolean)
        .join(" ")

    return (
        <li
            className={classes}
            aria-current={isSelected ? "true" : undefined}
            draggable={isDragArmed}
            onFocus={(): void => {
                if (!isSelected) {
                    selectTask(task.id)
                }
            }}
            onClick={handleClick}
            onDragStart={(event): void => onDragStart(task.id, event)}
            onDragOver={(event): void => onDragOver(task.id, event)}
            onDrop={(event): void => event.preventDefault()}
            onPointerUp={(): void => setIsDragArmed(false)}
            onDragEnd={(): void => {
                setIsDragArmed(false)
                onDragEnd()
            }}
        >
            <span className="dk-grip" title="Drag to reorder" onPointerDown={(): void => setIsDragArmed(true)}>
                <Icon path={ICONS.grip} />
            </span>

            <span className="dk-count-cell" data-field="due" title="Change the due date">
                <CountdownBlock task={task} today={today} />
            </span>

            <div className="dk-body">
                <div className="dk-title-line">
                    <textarea
                        ref={(area): void => {
                            title.current = area
                            registerTitle(task.id, area)
                        }}
                        className="dk-title"
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
                        aria-describedby={metaId}
                    />
                    <DictationButton
                        targetId={task.id}
                        targetName={names.dictationTarget}
                        dictation={dictation}
                        onToggle={(): void => toggleDictation(task.id)}
                    />
                </div>
                <p id={metaId} className="dk-meta">
                    <span className="dk-visually-hidden">{status}. </span>
                    <span className="dk-meta-part" data-field="priority" title="Change the priority">
                        <PriorityPips priority={task.priority} />
                        <span>Priority {task.priority}</span>
                    </span>
                    <span className="dk-meta-part dk-meta-date" data-field="due" title="Change the due date">
                        {dueDate ? `Due ${dueDate}` : "No due date"}
                    </span>
                    <span className="dk-visually-hidden">. Assigned to {user?.name ?? "nobody"}.</span>
                    {isSelected && (
                        <span className="dk-editing-tag" aria-hidden="true">
                            <Icon path={ICONS.pencil} size={12} />
                            Editing below
                        </span>
                    )}
                </p>
            </div>

            <button
                ref={(button): void => registerEditButton(task.id, button)}
                type="button"
                className="dk-who"
                data-field="assignee"
                aria-label={`Edit details for ${names.dictationTarget}`}
                aria-describedby={metaId}
                onClick={(event): void => selectTask(task.id, event.detail > 0 ? "assignee" : "due")}
            >
                <Avatar user={user} size="md" />
                <span className="dk-who-name">{user?.name ?? "Unassigned"}</span>
            </button>

            <span className="dk-done-cell">
                <input
                    type="checkbox"
                    className="dk-done"
                    checked={task.completed}
                    title="Done"
                    onChange={(event): void => updateTask(task.id, { completed: event.target.checked })}
                    aria-label={names.completed}
                />
            </span>
        </li>
    )
}

/* ---------- Header ---------- */

const Header: FC<{
    taskCount: number
    assigneeFilter: string
    onFilterChange(id: string): void
    onAddTask(): void
    addButton: RefObject<HTMLButtonElement | null>
}> = ({ taskCount, assigneeFilter, onFilterChange, onAddTask, addButton }) => (
    <header className="dk-header">
        <div className="dk-masthead">
            <h1>Task Manager</h1>
            <p className="dk-count-text">
                {taskCount} task{taskCount === 1 ? "" : "s"}
            </p>
            <div className="dk-header-actions">
                {/* The account area is out of scope; this only fills its place. */}
                <button type="button" className="dk-button dk-button-quiet" title="Not part of the prototype">
                    Sign in with Google
                </button>
                <button ref={addButton} type="button" className="dk-button dk-button-primary" onClick={onAddTask}>
                    <Icon path={ICONS.plus} />
                    Add Task
                </button>
            </div>
        </div>

        <div className="dk-header-row">
            <div className="dk-filter" role="group" aria-labelledby="dk-filter-label">
                <span id="dk-filter-label" className="dk-small-caps dk-filter-label">
                    Assignee
                </span>
                <button
                    type="button"
                    className="dk-filter-option"
                    aria-pressed={assigneeFilter === ""}
                    onClick={(): void => onFilterChange("")}
                >
                    All assignees
                </button>
                {alphabeticalUsers.map((user) => (
                    <button
                        key={user.id}
                        type="button"
                        className="dk-filter-option"
                        aria-pressed={assigneeFilter === user.id}
                        onClick={(): void => onFilterChange(user.id)}
                    >
                        <Avatar user={user} />
                        {user.name}
                    </button>
                ))}
            </div>

            <p className="dk-hint">
                Dictate a task title: click its{" "}
                <span className="dk-hint-mic">
                    <MicrophoneIcon label="microphone" />
                </span>{" "}
                button, or click a title and press <kbd>Ctrl</kbd> + <kbd>Alt</kbd>. These both toggle the mic on/off.
            </p>
        </div>
    </header>
)

/* ---------- Reviewer controls. Not part of the design. ---------- */

const ReviewerBar: FC<{
    availability: SimulatedAvailability
    onAvailabilityChange(value: SimulatedAvailability): void
}> = ({ availability, onAvailabilityChange }) => (
    <aside className="dk-review-bar" aria-label="Prototype controls">
        <p>
            <strong>Prototype: Distinctive</strong> (TM #56). Sample tasks only; nothing is saved.{" "}
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
    </aside>
)

/* ---------- The page ---------- */

export const DistinctiveApp: FC = () => {
    const [today] = useState(() => new Date())
    const [tasks, setTasks] = useState<TaskType[]>(() => createPrototypeTasks(today))
    const [assigneeFilter, setAssigneeFilter] = useState("")
    const [availability, setAvailability] = useState<SimulatedAvailability>("available")
    const [meter, setMeter] = useState<MeterChoice>({ style: "bar", bar: "solid", needle: "classic", waveform: "pill" })
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [focusRequest, setFocusRequest] = useState<{ field: DockField; count: number } | null>(null)
    const [draggedId, setDraggedId] = useState<string | null>(null)
    const dictation = useSimulatedDictation(availability)

    const titleInputs = useRef(new Map<string, HTMLTextAreaElement>())
    const editButtons = useRef(new Map<string, HTMLButtonElement>())
    const addButton = useRef<HTMLButtonElement>(null)
    const focusAfterRender = useRef<(() => void) | null>(null)
    const nextNewId = useRef(0)

    useEffect(() => {
        focusAfterRender.current?.()
        focusAfterRender.current = null
    }, [tasks])

    const visibleTasks = tasks.filter((task) => assigneeFilter === "" || task.userId === assigneeFilter)
    // There is always a selection while any task is on show: the chosen one, or else the first.
    const selectedIndex = Math.max(
        0,
        visibleTasks.findIndex((task) => task.id === selectedId),
    )
    const selectedTask = visibleTasks[selectedIndex]

    const registerTitle = (id: string, area: HTMLTextAreaElement | null): void => {
        if (area) {
            titleInputs.current.set(id, area)
        } else {
            titleInputs.current.delete(id)
        }
    }

    const registerEditButton = (id: string, button: HTMLButtonElement | null): void => {
        if (button) {
            editButtons.current.set(id, button)
        } else {
            editButtons.current.delete(id)
        }
    }

    const selectTask = (id: string, field?: DockField): void => {
        setSelectedId(id)

        if (field) {
            setFocusRequest((current) => ({ field, count: (current?.count ?? 0) + 1 }))
        }
    }

    const updateTask = (id: string, changes: Partial<TaskType>): void =>
        setTasks((current) => current.map((task) => (task.id === id ? { ...task, ...changes } : task)))

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
        setSelectedId(task.id)
        focusAfterRender.current = (): void => {
            titleInputs.current.get(task.id)?.focus()
            titleInputs.current.get(task.id)?.select()
        }
    }

    const deleteTask = (id: string): void => {
        if (dictation.activeTargetId === id) {
            dictation.stop("task_deleted")
        }

        // The next entry, or the previous one if this was the last, becomes
        // the selection and takes focus.
        const index = visibleTasks.findIndex((task) => task.id === id)
        const neighbour = visibleTasks[index + 1] ?? visibleTasks[index - 1]
        setSelectedId(neighbour?.id ?? null)
        focusAfterRender.current = (): void => {
            ;(neighbour ? titleInputs.current.get(neighbour.id) : addButton.current)?.focus()
        }

        setTasks((current) => current.filter((task) => task.id !== id))
    }

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

    const handleDragOver = (overId: string, event: DragEvent<HTMLLIElement>): void => {
        if (!draggedId) {
            return
        }

        event.preventDefault()

        if (overId === draggedId) {
            return
        }

        // Move once the pointer crosses the middle of the entry it is over, as the app does.
        const from = tasks.findIndex((task) => task.id === draggedId)
        const to = tasks.findIndex((task) => task.id === overId)
        const box = event.currentTarget.getBoundingClientRect()
        const isPastMiddle = event.clientY - box.top > box.height / 2

        if ((from < to && isPastMiddle) || (from > to && !isPastMiddle)) {
            setTasks((current) => reorderTasks(current, from, to))
        }
    }

    return (
        <div className="dk-page">
            <ReviewerBar availability={availability} onAvailabilityChange={setAvailability} />

            <div className="dk-scroll">
                <main className="dk-main">
                    <Header
                        taskCount={tasks.length}
                        assigneeFilter={assigneeFilter}
                        onFilterChange={setAssigneeFilter}
                        onAddTask={addTask}
                        addButton={addButton}
                    />

                    {visibleTasks.length === 0 ? (
                        <p className="dk-empty">No tasks for this assignee.</p>
                    ) : (
                        <ul className="dk-list" aria-label="Tasks">
                            {visibleTasks.map((task, visibleIndex) => (
                                <Entry
                                    key={task.id}
                                    task={task}
                                    visiblePosition={visibleIndex + 1}
                                    today={today}
                                    dictation={dictation}
                                    isSelected={task.id === selectedTask?.id}
                                    isDragging={draggedId === task.id}
                                    registerTitle={registerTitle}
                                    registerEditButton={registerEditButton}
                                    selectTask={selectTask}
                                    updateTask={updateTask}
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
                        </ul>
                    )}

                    <div className="dk-list-foot">
                        <button
                            type="button"
                            className="dk-link"
                            onClick={(): void => {
                                dictation.stop("task_deleted")
                                setSelectedId(null)
                                setTasks(createPrototypeTasks(today))
                            }}
                        >
                            Reset to sample tasks
                        </button>
                    </div>
                </main>
            </div>

            <Dock
                task={selectedTask}
                visiblePosition={selectedIndex + 1}
                today={today}
                focusRequest={focusRequest}
                dictation={dictation}
                meter={meter}
                onMeterChange={setMeter}
                updateTask={updateTask}
                deleteTask={deleteTask}
                onEscape={(): void => {
                    if (selectedTask) {
                        editButtons.current.get(selectedTask.id)?.focus()
                    }
                }}
            />
        </div>
    )
}
