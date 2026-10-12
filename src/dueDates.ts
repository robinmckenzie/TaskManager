import { differenceInCalendarDays, parseISO } from "date-fns"

/**
 * Returns the number of local calendar days until a task is due, whatever the
 * time of day, or null when the task has no due date.
 *
 * Positive = future
 * 0 = today
 * Negative = overdue
 */
export const getDaysUntilDue = (dueDate: string, today: Date = new Date()): number | null => {
    const days = differenceInCalendarDays(parseISO(dueDate), today)

    return Number.isNaN(days) ? null : days
}

const formatDays = (days: number): string => `${days} day${days === 1 ? "" : "s"}`

/** Describes when a task is due, for display beneath its title. */
export const describeDueStatus = (daysUntilDue: number | null, completed: boolean): string => {
    if (completed) {
        return "Completed"
    }

    if (daysUntilDue === null) {
        return "No due date"
    }

    if (daysUntilDue < 0) {
        return `${formatDays(Math.abs(daysUntilDue))} overdue`
    }

    return daysUntilDue === 0 ? "Due today" : `${formatDays(daysUntilDue)} remaining`
}
