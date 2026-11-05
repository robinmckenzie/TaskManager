import { addDays, format } from "date-fns"
import { getDaysUntilDue } from "../dueDates"
import type { TaskType } from "../tasks"

/*
 * Sample data for the TM #56 visual prototypes. Every prototype shows these
 * same tasks and assignees, so that the concepts can be compared fairly. This
 * file is data and pure logic only: it holds no markup or styling, and a
 * prototype is free to present the tasks however it likes.
 *
 * Nothing here reads or writes `taskmanager.tasks` or any other storage.
 */

export interface PrototypeUser {
    id: string
    name: string
    /** The same photo address as the app. Blocked during browser checks. */
    photo: string
    /** Shown in place of the photo when it cannot be loaded. */
    initials: string
}

/** The app's four assignees, with the same ids, names and photos. */
export const prototypeUsers: PrototypeUser[] = [
    { id: "1", name: "Alice", photo: "https://i.pravatar.cc/100?img=1", initials: "A" },
    { id: "2", name: "Bob", photo: "https://i.pravatar.cc/100?img=2", initials: "B" },
    { id: "3", name: "Charlie", photo: "https://i.pravatar.cc/100?img=3", initials: "C" },
    { id: "4", name: "Aaron", photo: "https://i.pravatar.cc/100?img=4", initials: "Aa" },
]

/**
 * The due states that the app distinguishes. They match the thresholds of
 * `getBackgroundClass` in `src/App.tsx`: overdue before today, due soon today
 * or tomorrow, due this week within three days, and due later after that.
 */
export type TaskState = "completed" | "overdue" | "due-soon" | "due-this-week" | "due-later" | "no-due-date"

export const getTaskState = (task: Pick<TaskType, "dueDate" | "completed">, today: Date): TaskState => {
    if (task.completed) {
        return "completed"
    }

    const days = getDaysUntilDue(task.dueDate, today)

    if (days === null) {
        return "no-due-date"
    }

    if (days < 0) {
        return "overdue"
    }

    if (days <= 1) {
        return "due-soon"
    }

    return days <= 3 ? "due-this-week" : "due-later"
}

/**
 * One task for every state, with both ends of "due soon", every priority and
 * every assignee, a long title, and a completed task whose date has passed.
 * Due dates are calendar days from today, or null for no due date.
 */
const sampleTasks: (Omit<TaskType, "dueDate"> & { dueInDays: number | null })[] = [
    { id: "p-1", text: "Fix authentication bug", userId: "2", priority: 5, dueInDays: -2, completed: false },
    { id: "p-2", text: "Prepare sprint demo", userId: "1", priority: 4, dueInDays: 0, completed: false },
    { id: "p-3", text: "Review dictation pull request", userId: "3", priority: 3, dueInDays: 1, completed: false },
    { id: "p-4", text: "Write release notes", userId: "4", priority: 2, dueInDays: 3, completed: false },
    {
        id: "p-5",
        text: "Update the onboarding documentation for contributors joining the project next month",
        userId: "3",
        priority: 3,
        dueInDays: 10,
        completed: false,
    },
    { id: "p-6", text: "Plan the next quarter's roadmap", userId: "1", priority: 1, dueInDays: null, completed: false },
    { id: "p-7", text: "Deploy initial build", userId: "2", priority: 5, dueInDays: -3, completed: true },
]

/** A fresh copy of the sample tasks, with due dates worked out from `today`. */
export const createPrototypeTasks = (today: Date = new Date()): TaskType[] =>
    sampleTasks.map(({ dueInDays, ...task }) => ({
        ...task,
        dueDate: dueInDays === null ? "" : format(addDays(today, dueInDays), "yyyy-MM-dd"),
    }))
