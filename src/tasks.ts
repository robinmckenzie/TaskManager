import { addDays, format } from "date-fns"

export interface TaskType {
    id: string
    text: string
    userId: string
    priority: number
    dueDate: string
    completed: boolean
}

export const TASKS_STORAGE_KEY = "taskmanager.tasks"

export const reorderTasks = (
    tasks: TaskType[],
    fromIndex: number,
    toIndex: number,
): TaskType[] => {
    const updatedTasks = [...tasks]
    const movedTask = updatedTasks.splice(fromIndex, 1)[0]

    if (!movedTask) {
        return tasks
    }

    updatedTasks.splice(toIndex, 0, movedTask)
    return updatedTasks
}

/**
 * Sample tasks, with due dates as calendar days relative to today, or null for
 * no due date. Together they show every due state, every priority and every
 * assignee, a long title, and a completed task whose date has passed.
 */
const sampleTasks: (Omit<TaskType, "dueDate"> & { dueInDays: number | null })[] = [
    { id: "task-1", text: "Fix authentication bug", userId: "2", priority: 5, dueInDays: -2, completed: false },
    { id: "task-2", text: "Prepare sprint demo", userId: "1", priority: 4, dueInDays: 0, completed: false },
    { id: "task-3", text: "Review dictation pull request", userId: "3", priority: 3, dueInDays: 1, completed: false },
    { id: "task-4", text: "Write release notes", userId: "4", priority: 2, dueInDays: 3, completed: false },
    {
        id: "task-5",
        text: "Update the onboarding documentation for contributors joining the project next month",
        userId: "3",
        priority: 3,
        dueInDays: 10,
        completed: false,
    },
    { id: "task-6", text: "Plan the next quarter's roadmap", userId: "1", priority: 1, dueInDays: null, completed: false },
    { id: "task-7", text: "Deploy initial build", userId: "2", priority: 5, dueInDays: -3, completed: true },
]

/**
 * Creates the sample tasks shown when nothing is saved. Their due dates are
 * worked out from the local calendar date of `today`, whatever its time of day.
 */
export const createSampleTasks = (today: Date = new Date()): TaskType[] =>
    sampleTasks.map(({ dueInDays, ...task }) => ({
        ...task,
        dueDate: dueInDays === null ? "" : format(addDays(today, dueInDays), "yyyy-MM-dd"),
    }))

const isTask = (value: unknown): value is TaskType => {
    if (typeof value !== "object" || value === null) {
        return false
    }

    const task = value as Record<string, unknown>

    return (
        typeof task.id === "string" &&
        typeof task.text === "string" &&
        typeof task.userId === "string" &&
        typeof task.priority === "number" &&
        typeof task.dueDate === "string" &&
        typeof task.completed === "boolean"
    )
}

export const loadTasks = (
    storage?: Pick<Storage, "getItem">,
    today: Date = new Date(),
): TaskType[] => {
    try {
        const savedTasks = (storage ?? localStorage).getItem(TASKS_STORAGE_KEY)

        if (savedTasks === null) {
            return createSampleTasks(today)
        }

        const parsedTasks: unknown = JSON.parse(savedTasks)

        if (Array.isArray(parsedTasks) && parsedTasks.every(isTask)) {
            return parsedTasks
        }

        console.warn("Saved tasks have an incompatible format. Using sample tasks.")
    } catch (error) {
        console.warn("Unable to load saved tasks. Using sample tasks.", error)
    }

    return createSampleTasks(today)
}
