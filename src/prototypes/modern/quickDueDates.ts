import { addDays, format, isSameYear } from "date-fns"
import type { TaskType } from "../../tasks"

/*
 * Pure helpers for the Modern prototype's quick due-date buttons, kept apart
 * from the markup so they can be unit tested. Dates use the app's local
 * `yyyy-MM-dd` form, the same form the date input reads and writes.
 */

export interface QuickDueDate {
    /** The button's visible text. */
    label: string
    /** The date in the app's `yyyy-MM-dd` form. */
    value: string
    /** The date in words, such as "Thu 5 Nov", with the year when it is not this year's. */
    description: string
}

const describeDate = (date: Date, today: Date): string =>
    format(date, isSameYear(date, today) ? "EEE d MMM" : "EEE d MMM yyyy")

const toQuickDueDate = (label: string, date: Date, today: Date): QuickDueDate => ({
    label,
    value: format(date, "yyyy-MM-dd"),
    description: describeDate(date, today),
})

/** The one-click due dates offered in the details panel: today, tomorrow and a week ahead, in local time. */
export const getQuickDueDates = (today: Date): QuickDueDate[] => [
    toQuickDueDate("Today", today, today),
    toQuickDueDate("Tomorrow", addDays(today, 1), today),
    toQuickDueDate("In a week", addDays(today, 7), today),
]

/** Applies changes to one task, leaving the list and every other task untouched. */
export const updateTaskInList = (tasks: TaskType[], id: string, changes: Partial<TaskType>): TaskType[] =>
    tasks.map((task) => (task.id === id ? { ...task, ...changes } : task))
