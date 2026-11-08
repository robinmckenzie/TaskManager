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

/** The states a task's due date can put it in, with completed taking precedence. */
export type DueStateKind =
    | "completed"
    | "none"
    | "overdue"
    | "due-soon"
    | "due-this-week"
    | "later"

export interface DueState {
    kind: DueStateKind
    /** Calendar days until due, or null when there is no usable due date. */
    daysUntilDue: number | null
}

/**
 * Decides a task's due state, in one place. Completed takes precedence over any
 * due date, and an unusable due date counts as none.
 *
 * Overdue is before today, due soon is today or tomorrow, due this week is 2 to
 * 3 days away, and anything later is later.
 */
export const getDueState = (
    dueDate: string,
    completed: boolean,
    today: Date = new Date(),
): DueState => {
    const daysUntilDue = getDaysUntilDue(dueDate, today)

    if (completed) {
        return { kind: "completed", daysUntilDue }
    }

    if (daysUntilDue === null) {
        return { kind: "none", daysUntilDue }
    }

    if (daysUntilDue < 0) {
        return { kind: "overdue", daysUntilDue }
    }

    if (daysUntilDue <= 1) {
        return { kind: "due-soon", daysUntilDue }
    }

    if (daysUntilDue <= 3) {
        return { kind: "due-this-week", daysUntilDue }
    }

    return { kind: "later", daysUntilDue }
}
