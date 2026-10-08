import { differenceInCalendarDays, parseISO } from "date-fns"

/**
 * Returns the number of local calendar days until a task is due, whatever the
 * time of day.
 *
 * Positive = future
 * 0 = today
 * Negative = overdue
 */
export const getDaysUntilDue = (dueDate: string, today: Date = new Date()): number =>
    differenceInCalendarDays(parseISO(dueDate), today)

const formatDays = (days: number): string => `${days} day${days === 1 ? "" : "s"}`

/** Describes when a task is due, for display beneath its title. */
export const describeDueStatus = (daysUntilDue: number, completed: boolean): string => {
    if (completed) {
        return "Completed"
    }

    if (daysUntilDue < 0) {
        return `${formatDays(Math.abs(daysUntilDue))} overdue`
    }

    return daysUntilDue === 0 ? "Due today" : `${formatDays(daysUntilDue)} remaining`
}
