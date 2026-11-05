import { addDays, format, isSameYear, parseISO } from "date-fns"
import { getDaysUntilDue } from "../../dueDates"
import type { TaskType } from "../../tasks"
import { getTaskState } from "../sampleTasks"
import type { TaskState } from "../sampleTasks"

/*
 * Pure helpers for the Distinctive ("Docket") prototype: the wording of each
 * entry's countdown block, the short due date, and the dock's quick due dates.
 * Kept apart from the markup so they can be unit tested.
 */

/** What the countdown block at the start of an entry shows, top to bottom. */
export interface Countdown {
    state: TaskState
    /** A short word above the figure, such as "Overdue" or "Due in". */
    label: string
    /** The figure itself: a day count, "Today", or a dash. Empty for completed tasks, which show a tick. */
    figure: string
    /** The unit below the figure: "day", "days" or nothing. */
    unit: string
}

const unitFor = (days: number): string => (days === 1 ? "day" : "days")

export const describeCountdown = (task: Pick<TaskType, "dueDate" | "completed">, today: Date): Countdown => {
    const state = getTaskState(task, today)
    const days = getDaysUntilDue(task.dueDate, today)

    if (state === "completed") {
        return { state, label: "Done", figure: "", unit: "" }
    }

    if (days === null) {
        return { state, label: "No date", figure: "–", unit: "" }
    }

    if (days < 0) {
        return { state, label: "Overdue", figure: String(-days), unit: unitFor(-days) }
    }

    if (days === 0) {
        return { state, label: "Due", figure: "Today", unit: "" }
    }

    return { state, label: "Due in", figure: String(days), unit: unitFor(days) }
}

/** "Tue 3 Nov", with the year added when it is not this year's. Empty for no due date. */
export const formatDueDate = (dueDate: string, today: Date): string => {
    if (!dueDate) {
        return ""
    }

    const date = parseISO(dueDate)

    return format(date, isSameYear(date, today) ? "EEE d MMM" : "EEE d MMM yyyy")
}

export interface QuickDueDate {
    label: string
    /** The date in the app's `yyyy-MM-dd` form. */
    value: string
}

/** The one-click due dates offered in the dock. */
export const getQuickDueDates = (today: Date): QuickDueDate[] => [
    { label: "Today", value: format(today, "yyyy-MM-dd") },
    { label: "Tomorrow", value: format(addDays(today, 1), "yyyy-MM-dd") },
    { label: "In a week", value: format(addDays(today, 7), "yyyy-MM-dd") },
]
