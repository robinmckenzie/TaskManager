import React, { useEffect, useRef, useState } from "react"
import type { FC } from "react"

import { DndProvider, useDrag, useDrop } from "react-dnd"

import type { DropTargetMonitor } from "react-dnd"

import { HTML5Backend } from "react-dnd-html5-backend"

import { format } from "date-fns"

import { createSampleTasks, loadTasks, reorderTasks, TASKS_STORAGE_KEY } from "./tasks"
import type { TaskType } from "./tasks"
import {
    getVisibleTasks,
    loadAssigneeFilter,
    saveAssigneeFilter,
} from "./assigneeFilter"
import { describeDueStatus, formatShortDate, getDueState } from "./dueDates"
import type { DueStateKind } from "./dueDates"
import { keepPanelIfShown, togglePanel } from "./detailsPanel"
import type { DetailField, OpenPanel } from "./detailsPanel"
import { findTaskToFocusAfterDelete, findTaskToFocusAfterHidden } from "./focusAfterDelete"
import { getQuickDueDates } from "./quickDueDates"
import { getTaskControlNames } from "./taskControlNames"
import { summariseTasks } from "./taskSummary"
import { describeTaskSummary, describeTaskView } from "./taskView"
import { getNewTaskAssignee, sortAssigneesByName } from "./users"
import type { User } from "./users"
import { useToday } from "./useToday"
import { AccountControl } from "./account/AccountControl"
import { Avatar } from "./Avatar"
import { Icon } from "./Icon"
import type { IconName } from "./Icon"
import { PriorityBars } from "./PriorityBars"
import { Sidebar } from "./Sidebar"
import { TaskDetails } from "./TaskDetails"
import { DictationButton } from "./dictation/DictationButton"
import { DictationStatus, MeterStyleSelector } from "./dictation/DictationFeedback"
import type { MeterChoice } from "./dictation/LevelMeter"
import { useDictation } from "./dictation/useDictation"
import { toSingleLine } from "./singleLineText"
import { useAutoGrow } from "./useAutoGrow"
import type { Dictation } from "./dictation/useDictation"

import "./index.css"

const TASK_DRAG_TYPE = "TASK"

const DUE_STATE_CLASSES: Record<DueStateKind, string> = {
    completed: "task-completed",
    none: "task-normal",
    overdue: "task-overdue",
    "due-soon": "task-due-soon",
    "due-this-week": "task-due-this-week",
    later: "task-normal",
}

/** The shape drawn beside each due state, so that colour is never the only signal. */
const DUE_STATE_ICONS: Record<DueStateKind, IconName> = {
    completed: "check",
    none: "dash",
    overdue: "warning",
    "due-soon": "clock",
    "due-this-week": "calendar",
    later: "arrow",
}

interface DragItem {
    type: string
    id: string
    index: number
}

interface TaskProps {
    task: TaskType
    index: number
    /** The task's place among the tasks on show, counted from 1. */
    visiblePosition: number
    users: User[]
    today: Date
    moveTask: (fromIndex: number, toIndex: number) => void
    updateTask: (id: string, changes: Partial<TaskType>) => void
    deleteTask: (id: string) => void
    registerTitleInput: (id: string, input: HTMLTextAreaElement | null) => void
    registerSummaryButton: (id: string, button: HTMLButtonElement | null) => void
    /** Changes the assignee, and closes the panel if that hides the task under the filter. */
    changeAssignee: (id: string, userId: string) => void
    /** The field to focus if this task's details panel is open, else undefined. */
    openPanel: OpenPanel | undefined
    togglePanel: (id: string, field: DetailField | null) => void
    dictation: Dictation
}

const initialUsers: User[] = [
    {
        id: "1",
        name: "Alice",
        photo: "https://i.pravatar.cc/100?img=1",
    },
    {
        id: "2",
        name: "Bob",
        photo: "https://i.pravatar.cc/100?img=2",
    },
    {
        id: "3",
        name: "Charlie",
        photo: "https://i.pravatar.cc/100?img=3",
    },
    { id: "4", name: "Aaron", photo: "https://i.pravatar.cc/100?img=4" },
]

const useTaskDrag = (id: string, index: number) =>
    useDrag<DragItem, void, { isDragging: boolean }>({
        type: TASK_DRAG_TYPE,
        item: (): DragItem => ({ type: TASK_DRAG_TYPE, id, index }),
        collect: (monitor): { isDragging: boolean } => ({
            isDragging: monitor.isDragging(),
        }),
    })

const Task: FC<TaskProps> = ({
    task,
    index,
    visiblePosition,
    users,
    today,
    moveTask,
    updateTask,
    deleteTask,
    registerTitleInput,
    registerSummaryButton,
    changeAssignee,
    openPanel,
    togglePanel: toggleTaskPanel,
    dictation,
}) => {
    const ref = useRef<HTMLDivElement>(null)

    const user: User | undefined = users.find(
        (currentUser: User) => currentUser.id === task.userId,
    )

    const controlNames = getTaskControlNames(task.text, visiblePosition)

    const dueState = getDueState(task.dueDate, task.completed, today)

    const shortDate = formatShortDate(task.dueDate)

    /*
     * react-dnd drop target.
     *
     * IMPORTANT:
     * `hover` is a genuine part of react-dnd's useDrop API.
     *
     * We use it to move the task while dragging rather
     * than waiting until the user releases the mouse.
     */
    const [, drop] = useDrop<DragItem, void, Record<string, never>>({
        accept: TASK_DRAG_TYPE,

        hover(
            item: DragItem,
            monitor: DropTargetMonitor<DragItem, void>,
        ): void {
            if (!ref.current) {
                return
            }

            const dragIndex: number = item.index
            const hoverIndex: number = index

            if (dragIndex === hoverIndex) {
                return
            }

            const hoverBoundingRect: DOMRect =
                ref.current.getBoundingClientRect()

            const hoverMiddleY: number =
                (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2

            const clientOffset = monitor.getClientOffset()

            if (!clientOffset) {
                return
            }

            const hoverClientY: number = clientOffset.y - hoverBoundingRect.top

            /*
             * Only move once the dragged item has crossed
             * the halfway point of the item we're hovering over.
             *
             * This prevents the list from jumping around.
             */
            if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
                return
            }

            if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
                return
            }

            moveTask(dragIndex, hoverIndex)

            /*
             * Update the dragged item's index so subsequent
             * hover events use its new position.
             */
            item.index = hoverIndex
        },
    })

    /*
     * react-dnd drag source.
     */
    const [{ isDragging }, connectGrip, connectPreview] = useTaskDrag(task.id, index)

    const titleRef = useRef<HTMLTextAreaElement | null>(null)
    useAutoGrow(titleRef, task.text)

    const changeTitle = (text: string): void => {
        dictation.recordEdit(task.id, task.text, text)
        updateTask(task.id, {
            text,
        })
    }

    const handleTextChange = (
        event: React.ChangeEvent<HTMLTextAreaElement>,
    ): void => {
        changeTitle(toSingleLine(event.target.value))
    }

    // Enter would add a line break, but a title is a single line, so it does nothing.
    // (Enter that confirms an input-method composition must still get through.)
    const handleTitleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
        if (event.key === "Enter" && !event.nativeEvent.isComposing) {
            event.preventDefault()
        }
    }

    // Pasted line breaks become spaces. Doing it here, not only in handleTextChange,
    // keeps the caret just after the pasted text instead of jumping to the end.
    const handleTitlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>): void => {
        const pasted = event.clipboardData.getData("text")

        if (toSingleLine(pasted) === pasted) {
            return
        }

        event.preventDefault()

        const area = event.currentTarget
        area.setRangeText(toSingleLine(pasted), area.selectionStart, area.selectionEnd, "end")
        changeTitle(area.value)
    }

    const summaryRef = useRef<HTMLButtonElement | null>(null)
    const isOpen = openPanel !== undefined
    const panelId = `task-details-${task.id}`
    const summaryId = `task-summary-${task.id}`

    const handleSummaryClick = (event: React.MouseEvent<HTMLButtonElement>): void => {
        // A pointer click on one part of the summary opens the panel at that
        // field. From the keyboard (a click with no pointer), focus stays on the
        // button, as for any disclosure.
        const part = (event.target as Element).closest<HTMLElement>("[data-field]")?.dataset.field
        const fromPointer = event.detail > 0

        toggleTaskPanel(task.id, fromPointer ? ((part as DetailField | undefined) ?? "due") : null)
    }

    const handleCompletedChange = (
        event: React.ChangeEvent<HTMLInputElement>,
    ): void => {
        updateTask(task.id, {
            completed: event.target.checked,
        })
    }

    return (
        <div
            ref={(element: HTMLDivElement | null): void => {
                ref.current = element

                drop(element)
                connectPreview(element)
            }}
            className={`task ${DUE_STATE_CLASSES[dueState.kind]}`}
            style={{
                opacity: isDragging ? 0.5 : 1,
            }}
        >
            <div className="task-row">
                <span
                    className="task-grip"
                    title="Drag to reorder"
                    ref={(element): void => {
                        connectGrip(element)
                    }}
                >
                    <Icon name="grip" />
                </span>

                <input
                    type="checkbox"
                    className="task-check"
                    checked={task.completed}
                    onChange={handleCompletedChange}
                    aria-label={controlNames.completed}
                />

                <div className="task-title-cell">
                    <textarea
                        rows={1}
                        ref={(area): void => {
                            titleRef.current = area
                            dictation.registerInput(task.id, area)
                            registerTitleInput(task.id, area)
                        }}
                        value={task.text}
                        onChange={handleTextChange}
                        onKeyDown={handleTitleKeyDown}
                        onPaste={handleTitlePaste}
                        placeholder="Untitled task"
                        className="task-title"
                        aria-label={controlNames.title}
                    />
                    <DictationButton
                        targetId={task.id}
                        targetName={controlNames.dictationTarget}
                        dictation={dictation}
                    />
                </div>

                <button
                    type="button"
                    ref={(button): void => {
                        summaryRef.current = button
                        registerSummaryButton(task.id, button)
                    }}
                    className="task-summary"
                    aria-expanded={isOpen}
                    aria-controls={isOpen ? panelId : undefined}
                    aria-label={`Edit details for ${controlNames.dictationTarget}`}
                    aria-describedby={`${summaryId}-due ${summaryId}-priority ${summaryId}-assignee`}
                    onClick={handleSummaryClick}
                >
                    <span id={`${summaryId}-due`} className={`task-due task-due-${dueState.kind}`} data-field="due">
                        <Icon name={DUE_STATE_ICONS[dueState.kind]} className="task-due-icon" size={14} />
                        <span>{describeDueStatus(dueState.daysUntilDue, task.completed)}</span>
                        {shortDate && <span className="task-due-date">{shortDate}</span>}
                    </span>
                    <span id={`${summaryId}-priority`} className="task-priority" data-field="priority">
                        <PriorityBars priority={task.priority} />
                        <span className="task-priority-number" aria-hidden="true">
                            {task.priority}
                        </span>
                        <span className="visually-hidden">Priority {task.priority} of 5</span>
                    </span>
                    <span id={`${summaryId}-assignee`} className="task-assignee" data-field="assignee">
                        <Avatar user={user} />
                        <span className="task-assignee-name">{user?.name ?? "Unassigned"}</span>
                    </span>
                </button>
            </div>

            {isOpen && openPanel && (
                <TaskDetails
                    task={task}
                    panelId={panelId}
                    names={controlNames}
                    users={users}
                    quickDueDates={getQuickDueDates(today)}
                    focusField={openPanel.focusField}
                    updateTask={updateTask}
                    changeAssignee={changeAssignee}
                    deleteTask={deleteTask}
                    onClose={(): void => {
                        toggleTaskPanel(task.id, null)
                        summaryRef.current?.focus()
                    }}
                />
            )}
        </div>
    )
}

const App: FC = () => {
    const [tasks, setTasks] = useState<TaskType[]>(loadTasks)

    const [users] = useState<User[]>(initialUsers)

    const today = useToday()

    const [assigneeFilter, setAssigneeFilter] = useState<string>(() =>
        loadAssigneeFilter(users),
    )

    // The details panel that is open, if any. Not saved.
    const [openPanel, setOpenPanel] = useState<OpenPanel | null>(null)

    useEffect(() => {
        saveAssigneeFilter(assigneeFilter)
    }, [assigneeFilter])

    const visibleTasks = getVisibleTasks(tasks, assigneeFilter)
    const alphabeticalUsers = sortAssigneesByName(users)
    const filteredUser = users.find((user: User): boolean => user.id === assigneeFilter)
    const view = describeTaskView(filteredUser?.name, visibleTasks.length, tasks.length)
    const summary = describeTaskSummary(
        summariseTasks(
            visibleTasks.map(({ task }): TaskType => task),
            today,
        ),
    )

    useEffect(() => {
        try {
            localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks))
        } catch (error) {
            console.warn(
                "Unable to save tasks. Changes will only be kept in memory.",
                error,
            )
        }
    }, [tasks])

    const titleInputs = useRef(new Map<string, HTMLTextAreaElement>())
    const summaryButtons = useRef(new Map<string, HTMLButtonElement>())
    const addButton = useRef<HTMLButtonElement>(null)

    const registerTitleInput = (id: string, input: HTMLTextAreaElement | null): void => {
        if (input) {
            titleInputs.current.set(id, input)
        } else {
            titleInputs.current.delete(id)
        }
    }

    const registerSummaryButton = (id: string, button: HTMLButtonElement | null): void => {
        if (button) {
            summaryButtons.current.set(id, button)
        } else {
            summaryButtons.current.delete(id)
        }
    }

    // Where focus goes once the task list has been drawn again, after a task
    // is added or deleted.
    const moveFocusAfterRender = useRef<(() => void) | null>(null)

    useEffect(() => {
        moveFocusAfterRender.current?.()
        moveFocusAfterRender.current = null
    }, [tasks, assigneeFilter])

    const addTask = (): void => {
        const newTask: TaskType = {
            id: `task-${Date.now()}`,
            text: "New task",
            userId: getNewTaskAssignee(assigneeFilter, users),
            priority: 3,
            dueDate: format(new Date(), "yyyy-MM-dd"),
            completed: false,
        }

        setTasks((currentTasks: TaskType[]): TaskType[] => [
            ...currentTasks,
            newTask,
        ])

        moveFocusAfterRender.current = (): void => {
            const input = titleInputs.current.get(newTask.id)

            // Select the placeholder title, so that typing replaces it.
            input?.focus()
            input?.select()
        }
    }

    const updateTask = (id: string, changes: Partial<TaskType>): void => {
        setTasks((currentTasks: TaskType[]): TaskType[] =>
            currentTasks.map(
                (task: TaskType): TaskType =>
                    task.id === id
                        ? {
                              ...task,
                              ...changes,
                          }
                        : task,
            ),
        )
    }

    const dictation = useDictation({
        vocabulary: users.map((user: User): string => user.name),
        getText: (id: string): string | undefined =>
            tasks.find((task: TaskType): boolean => task.id === id)?.text,
        setText: (id: string, text: string): void => updateTask(id, { text }),
    })

    const [meter, setMeter] = useState<MeterChoice>({
        style: "bar",
        bar: "solid",
        needle: "classic",
        waveform: "pill",
    })

    // Sends focus to where it goes when a task leaves the list on show: the next
    // task's summary button, else the previous one's, else Add Task.
    const moveFocusFromLeavingTask = (id: string): void => {
        const nextTaskId = findTaskToFocusAfterDelete(
            visibleTasks.map(({ task }): string => task.id),
            id,
        )

        moveFocusAfterRender.current = (): void => {
            const destination = nextTaskId
                ? summaryButtons.current.get(nextTaskId)
                : addButton.current

            destination?.focus()
        }
    }

    const toggleTaskPanel = (id: string, field: DetailField | null): void =>
        setOpenPanel((current: OpenPanel | null): OpenPanel | null => togglePanel(current, id, field))

    // Changing a task's assignee can hide it under the filter. Then its panel
    // closes and focus moves on, as after Delete.
    const changeAssignee = (id: string, userId: string): void => {
        if (assigneeFilter !== "" && userId !== assigneeFilter) {
            moveFocusFromLeavingTask(id)
            setOpenPanel((current: OpenPanel | null): OpenPanel | null =>
                current?.taskId === id ? null : current,
            )
        }

        updateTask(id, { userId })
    }

    // A new filter closes the panel of a task it hides. Focus then goes on as
    // after Delete: to the next task still on show, else the previous, else
    // Add Task.
    const changeFilter = (selection: string): void => {
        const shownTaskIds = getVisibleTasks(tasks, selection).map(({ task }): string => task.id)

        if (openPanel !== null && !shownTaskIds.includes(openPanel.taskId)) {
            const nextTaskId = findTaskToFocusAfterHidden(
                tasks.map((task: TaskType): string => task.id),
                shownTaskIds,
                openPanel.taskId,
            )

            moveFocusAfterRender.current = (): void => {
                const destination = nextTaskId
                    ? summaryButtons.current.get(nextTaskId)
                    : addButton.current

                destination?.focus()
            }
        }

        setOpenPanel((current: OpenPanel | null): OpenPanel | null =>
            keepPanelIfShown(current, shownTaskIds),
        )
        setAssigneeFilter(selection)
    }

    const deleteTask = (id: string): void => {
        moveFocusFromLeavingTask(id)
        setOpenPanel((current: OpenPanel | null): OpenPanel | null =>
            current?.taskId === id ? null : current,
        )

        dictation.removeTarget(id)
        setTasks((currentTasks: TaskType[]): TaskType[] =>
            currentTasks.filter((task: TaskType): boolean => task.id !== id),
        )
    }

    const resetToSampleTasks = (): void => {
        // Stop dictating into, and revising, the titles being replaced.
        tasks.forEach((task: TaskType): void => dictation.removeTarget(task.id))
        setOpenPanel(null)
        setTasks(createSampleTasks())
    }

    const moveTask = (fromIndex: number, toIndex: number): void => {
        setTasks((currentTasks: TaskType[]): TaskType[] =>
            reorderTasks(currentTasks, fromIndex, toIndex),
        )
    }

    return (
        <DndProvider backend={HTML5Backend}>
            <div className="app-shell">
                <Sidebar
                    tasks={tasks}
                    users={alphabeticalUsers}
                    assigneeFilter={assigneeFilter}
                    onFilterChange={changeFilter}
                />

                <div className="app-content">
                    <main className="app-main">
                        <AccountControl />

                        <header className="view-header">
                            <div>
                                <h1>{view.heading}</h1>
                                <p className="view-count">
                                    {view.count}
                                    {summary && <span className="view-summary"> · {summary}</span>}
                                </p>
                            </div>

                            <button
                                type="button"
                                ref={addButton}
                                onClick={addTask}
                                className="add-button"
                            >
                                <Icon name="plus" />
                                Add Task
                            </button>
                        </header>

                        <section className="task-list">
                            <div className="task-list-controls">
                                <DictationStatus dictation={dictation} meter={meter} />
                                <MeterStyleSelector meter={meter} onChange={setMeter} />
                            </div>
                            <div className="task-columns" aria-hidden="true">
                                <span className="task-column-task">Task</span>
                                <span className="task-column-due">Due</span>
                                <span className="task-column-priority">Priority</span>
                                <span className="task-column-assignee">Assignee</span>
                            </div>
                            {view.emptyMessage && <p className="empty-view">{view.emptyMessage}</p>}
                            {visibleTasks.map(({ task, index }, visibleIndex) => (
                                <Task
                                    key={task.id}
                                    task={task}
                                    index={index}
                                    visiblePosition={visibleIndex + 1}
                                    users={alphabeticalUsers}
                                    today={today}
                                    moveTask={moveTask}
                                    updateTask={updateTask}
                                    deleteTask={deleteTask}
                                    registerTitleInput={registerTitleInput}
                                    registerSummaryButton={registerSummaryButton}
                                    changeAssignee={changeAssignee}
                                    openPanel={openPanel?.taskId === task.id ? openPanel : undefined}
                                    togglePanel={toggleTaskPanel}
                                    dictation={dictation}
                                />
                            ))}
                            <button
                                type="button"
                                onClick={resetToSampleTasks}
                                className="reset-tasks-button"
                            >
                                Reset to sample tasks
                            </button>
                        </section>
                    </main>
                </div>
            </div>
        </DndProvider>
    )
}

export default App
