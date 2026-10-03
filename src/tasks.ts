export interface TaskType {
    id: string
    text: string
    userId: string
    priority: number
    dueDate: string
    completed: boolean
}

export const TASKS_STORAGE_KEY = "taskmanager.tasks"

export const initialTasks: TaskType[] = [
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

export const loadTasks = (storage?: Pick<Storage, "getItem">): TaskType[] => {
    try {
        const savedTasks = (storage ?? localStorage).getItem(TASKS_STORAGE_KEY)

        if (savedTasks === null) {
            return initialTasks
        }

        const parsedTasks: unknown = JSON.parse(savedTasks)

        if (Array.isArray(parsedTasks) && parsedTasks.every(isTask)) {
            return parsedTasks
        }

        console.warn("Saved tasks have an incompatible format. Using sample tasks.")
    } catch (error) {
        console.warn("Unable to load saved tasks. Using sample tasks.", error)
    }

    return initialTasks
}
