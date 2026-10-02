import React, { useRef, useState } from "react"
import type { FC } from "react"

import { DndProvider, useDrag, useDrop } from "react-dnd"

import type { DropTargetMonitor } from "react-dnd"

import { HTML5Backend } from "react-dnd-html5-backend"

import { differenceInDays, format, parseISO } from "date-fns"

import "./index.css"

const ITEM_TYPE = "TASK"

interface User {
    id: string
    name: string
    photo: string
}

interface TaskType {
    id: string
    text: string
    userId: string
    priority: number
    dueDate: string
    completed: boolean
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
]

const initialTasks: TaskType[] = [
    {
        id: "task-1",
        text: "Design UI",
        userId: "1",
        priority: 4,
        dueDate: "2026-10-05",
        completed: false,
    },
    {
        id: "task-2",
        text: "Fix authentication bug",
        userId: "2",
        priority: 5,
        dueDate: "2026-10-03",
        completed: false,
    },
    {
        id: "task-3",
        text: "Write documentation",
        userId: "3",
        priority: 2,
        dueDate: "2026-10-12",
        completed: false,
    },
    {
        id: "task-4",
        text: "Deploy to production",
        userId: "1",
        priority: 3,
        dueDate: "2026-10-01",
        completed: false,
    },
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

const Task: FC<TaskProps> = ({
    task,
    index,
    users,
    moveTask,
    updateTask,
    deleteTask,
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
        accept: ITEM_TYPE,

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
    const [{ isDragging }, drag] = useDrag<
        DragItem,
        void,
        { isDragging: boolean }
    >({
        type: ITEM_TYPE,

        item: (): DragItem => ({
            type: ITEM_TYPE,
            id: task.id,
            index,
        }),

        collect: (monitor): { isDragging: boolean } => ({
            isDragging: monitor.isDragging(),
        }),
    })

    const handleTextChange = (
        event: React.ChangeEvent<HTMLInputElement>,
    ): void => {
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
            ref={(node: HTMLDivElement | null): void => {
                ref.current = node

                if (node) {
                    drag(drop(node))
                }
            }}
            className={`task ${getBackgroundClass()}`}
            style={{
                opacity: isDragging ? 0.5 : 1,
                animationDuration: pulseDuration,
            }}
        >
            <div className="task-drag-handle">⋮⋮</div>

            <img
                src={user?.photo}
                alt={user?.name ?? "Unassigned"}
                className="user-photo"
            />

            <div className="task-main">
                <input
                    type="text"
                    value={task.text}
                    onChange={handleTextChange}
                    className="task-title"
                />

                <div className="task-details">
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
    const [tasks, setTasks] = useState<TaskType[]>(initialTasks)

    const [users] = useState<User[]>(initialUsers)

    const addTask = (): void => {
        const newTask: TaskType = {
            id: `task-${Date.now()}`,
            text: "New task",
            userId: users[0]?.id ?? "",
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

    const deleteTask = (id: string): void => {
        setTasks((currentTasks: TaskType[]): TaskType[] =>
            currentTasks.filter((task: TaskType): boolean => task.id !== id),
        )
    }

    const moveTask = (fromIndex: number, toIndex: number): void => {
        setTasks((currentTasks: TaskType[]): TaskType[] => {
            const updatedTasks: TaskType[] = [...currentTasks]

            const movedTask: TaskType | undefined = updatedTasks.splice(
                fromIndex,
                1,
            )[0]

            if (!movedTask) {
                return currentTasks
            }

            updatedTasks.splice(toIndex, 0, movedTask)

            return updatedTasks
        })
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

                <section className="task-list">
                    {tasks.map((task: TaskType, index: number) => (
                        <Task
                            key={task.id}
                            task={task}
                            index={index}
                            users={users}
                            moveTask={moveTask}
                            updateTask={updateTask}
                            deleteTask={deleteTask}
                        />
                    ))}
                </section>
            </main>
        </DndProvider>
    )
}

export default App
