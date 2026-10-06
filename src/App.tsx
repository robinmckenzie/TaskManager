import React, { useEffect, useRef, useState } from "react"
import type { FC } from "react"

import { DndProvider, useDrag, useDrop } from "react-dnd"

import type { DropTargetMonitor } from "react-dnd"

import { HTML5Backend } from "react-dnd-html5-backend"

import { differenceInDays, format, parseISO } from "date-fns"

import { loadTasks, reorderTasks, TASKS_STORAGE_KEY } from "./tasks"
import type { TaskType } from "./tasks"
import {
    getVisibleTasks,
    loadAssigneeFilter,
    saveAssigneeFilter,
} from "./assigneeFilter"
import { getNewTaskAssignee, sortAssigneesByName } from "./users"
import { DictationButton } from "./dictation/DictationButton"
import { useDictation } from "./dictation/useDictation"
import type { Dictation } from "./dictation/useDictation"

import "./index.css"

const TASK_DRAG_TYPE = "TASK"

interface User {
    id: string
    name: string
    photo: string
}

interface DragItem {
    type: string
    id: string
    index: number
}

interface TaskProps {
    task: TaskType
    index: number
    users: User[]
    moveTask: (fromIndex: number, toIndex: number) => void
    updateTask: (id: string, changes: Partial<TaskType>) => void
    deleteTask: (id: string) => void
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

/**
 * Returns the number of days until the task is due.
 *
 * Positive = future
 * 0 = today
 * Negative = overdue
 */
const getDaysUntilDue = (dueDate: string): number => {
    return differenceInDays(parseISO(dueDate), new Date())
}

/**
 * Calculate how quickly an overdue task should pulse.
 *
 * The further overdue it is, the faster it pulses.
 */
const getPulseDuration = (daysOverdue: number): string => {
    const duration: number = Math.max(0.4, 2.5 - daysOverdue * 0.3)

    return `${duration}s`
}

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
    users,
    moveTask,
    updateTask,
    deleteTask,
    dictation,
}) => {
    const ref = useRef<HTMLDivElement>(null)

    const user: User | undefined = users.find(
        (currentUser: User) => currentUser.id === task.userId,
    )

    const daysUntilDue: number = getDaysUntilDue(task.dueDate)

    const overdue: boolean = !task.completed && daysUntilDue < 0

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
    const [
        { isDragging: isLeftDragging },
        connectSourceElementForLeftDrag,
        connectPreviewElementForLeftDrag,
    ] = useTaskDrag(task.id, index)
    const [
        { isDragging: isDetailsDragging },
        connectSourceElementForDetailsDrag,
        connectPreviewElementForDetailsDrag,
    ] = useTaskDrag(task.id, index)
    const isDragging = isLeftDragging || isDetailsDragging

    const handleTextChange = (
        event: React.ChangeEvent<HTMLInputElement>,
    ): void => {
        dictation.recordEdit(task.id, task.text, event.target.value)
        updateTask(task.id, {
            text: event.target.value,
        })
    }

    const handlePriorityChange = (
        event: React.ChangeEvent<HTMLInputElement>,
    ): void => {
        const priority: number = Number(event.target.value)

        updateTask(task.id, {
            priority,
        })
    }

    const handleUserChange = (
        event: React.ChangeEvent<HTMLSelectElement>,
    ): void => {
        updateTask(task.id, {
            userId: event.target.value,
        })
    }

    const handleDueDateChange = (
        event: React.ChangeEvent<HTMLInputElement>,
    ): void => {
        updateTask(task.id, {
            dueDate: event.target.value,
        })
    }

    const handleCompletedChange = (
        event: React.ChangeEvent<HTMLInputElement>,
    ): void => {
        updateTask(task.id, {
            completed: event.target.checked,
        })
    }

    const getBackgroundClass = (): string => {
        if (task.completed) {
            return "task-completed"
        }

        if (overdue) {
            return "task-overdue"
        }

        if (daysUntilDue <= 1) {
            return "task-due-soon"
        }

        if (daysUntilDue <= 3) {
            return "task-due-this-week"
        }

        return "task-normal"
    }

    const pulseDuration: string = overdue
        ? getPulseDuration(Math.abs(daysUntilDue))
        : "0s"

    return (
        <div
            ref={(element: HTMLDivElement | null): void => {
                ref.current = element

                drop(element)
                connectPreviewElementForLeftDrag(element)
                connectPreviewElementForDetailsDrag(element)
            }}
            className={`task ${getBackgroundClass()}`}
            style={{
                opacity: isDragging ? 0.5 : 1,
                animationDuration: pulseDuration,
            }}
        >
            <div
                className="task-left-drag-surface task-drag-surface"
                ref={(element): void => {
                    connectSourceElementForLeftDrag(element)
                }}
            >
                <div className="task-drag-handle">⋮⋮</div>
                <img
                    src={user?.photo}
                    alt={user?.name ?? "Unassigned"}
                    className="user-photo"
                    draggable={false}
                />
            </div>

            <div className="task-main">
                <div className="task-title-row">
                    <input
                        type="text"
                        ref={(input): void => dictation.registerInput(task.id, input)}
                        value={task.text}
                        onChange={handleTextChange}
                        className="task-title"
                    />
                    <DictationButton targetId={task.id} dictation={dictation} />
                </div>

                <div className="task-details">
                    <div
                        className="task-details-drag-surface task-drag-surface"
                        ref={(element): void => {
                            connectSourceElementForDetailsDrag(element)
                        }}
                        aria-hidden="true"
                    />
                    <label>
                        Due:
                        <input
                            type="date"
                            value={task.dueDate}
                            onChange={handleDueDateChange}
                        />
                    </label>

                    <span>
                        {task.completed
                            ? "Completed"
                            : overdue
                              ? `${Math.abs(daysUntilDue)} day${
                                    Math.abs(daysUntilDue) === 1 ? "" : "s"
                                } overdue`
                              : `${daysUntilDue} day${
                                    daysUntilDue === 1 ? "" : "s"
                                } remaining`}
                    </span>
                </div>
            </div>

            <div className="task-controls">
                <label className="priority-control">
                    <span>Priority: {task.priority}/5</span>

                    <input
                        type="range"
                        min="1"
                        max="5"
                        step="1"
                        value={task.priority}
                        onChange={handlePriorityChange}
                    />
                </label>

                <select value={task.userId} onChange={handleUserChange}>
                    {users.map((currentUser: User) => (
                        <option key={currentUser.id} value={currentUser.id}>
                            {currentUser.name}
                        </option>
                    ))}
                </select>

                <label className="completed-control">
                    <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={handleCompletedChange}
                    />
                    Complete
                </label>

                <button
                    type="button"
                    onClick={(): void => deleteTask(task.id)}
                    className="delete-button"
                >
                    Delete
                </button>
            </div>
        </div>
    )
}

const App: FC = () => {
    const [tasks, setTasks] = useState<TaskType[]>(loadTasks)

    const [users] = useState<User[]>(initialUsers)

    const [assigneeFilter, setAssigneeFilter] = useState<string>(() =>
        loadAssigneeFilter(users),
    )

    useEffect(() => {
        saveAssigneeFilter(assigneeFilter)
    }, [assigneeFilter])

    const visibleTasks = getVisibleTasks(tasks, assigneeFilter)
    const alphabeticalUsers = sortAssigneesByName(users)

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
        setText: (id: string, text: string): void => updateTask(id, { text }),
    })

    const deleteTask = (id: string): void => {
        dictation.removeTarget(id)
        setTasks((currentTasks: TaskType[]): TaskType[] =>
            currentTasks.filter((task: TaskType): boolean => task.id !== id),
        )
    }

    const moveTask = (fromIndex: number, toIndex: number): void => {
        setTasks((currentTasks: TaskType[]): TaskType[] =>
            reorderTasks(currentTasks, fromIndex, toIndex),
        )
    }

    return (
        <DndProvider backend={HTML5Backend}>
            <main className="app">
                <header className="app-header">
                    <div>
                        <h1>Task Manager</h1>
                        <p>
                            {tasks.length} task
                            {tasks.length === 1 ? "" : "s"}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={addTask}
                        className="add-button"
                    >
                        + Add Task
                    </button>
                </header>

                <p className="dictation-status" role="status">
                    {dictation.message}
                </p>

                <section className="task-list">
                    <label className="assignee-filter">
                        Assignee
                        <select
                            value={assigneeFilter}
                            onChange={(
                                event: React.ChangeEvent<HTMLSelectElement>,
                            ): void => setAssigneeFilter(event.target.value)}
                        >
                            <option value="">All assignees</option>
                            {alphabeticalUsers.map((user: User) => (
                                <option key={user.id} value={user.id}>
                                    {user.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    {visibleTasks.map(({ task, index }) => (
                        <Task
                            key={task.id}
                            task={task}
                            index={index}
                            users={alphabeticalUsers}
                            moveTask={moveTask}
                            updateTask={updateTask}
                            deleteTask={deleteTask}
                            dictation={dictation}
                        />
                    ))}
                </section>
            </main>
        </DndProvider>
    )
}

export default App
