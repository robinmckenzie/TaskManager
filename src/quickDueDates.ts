import { addDays, format } from "date-fns"

export type QuickDueDateName = "Today" | "Tomorrow" | "In a week"

export interface QuickDueDate {
    name: QuickDueDateName
    /** A local date in the form of a date field's value, such as 2026-11-08. */
    dueDate: string
}

const quickDueDateOffsets: { name: QuickDueDateName; days: number }[] = [
    { name: "Today", days: 0 },
    { name: "Tomorrow", days: 1 },
    { name: "In a week", days: 7 },
]

/**
 * Returns the quick due dates, worked out from the local calendar date of
 * `today` (the date the app follows), whatever its time of day. Whole calendar
 * days are added, so month ends, leap days and daylight-saving changes cannot
 * shift the result. `today` is not changed.
 */
export const getQuickDueDates = (today: Date): QuickDueDate[] =>
    quickDueDateOffsets.map(({ name, days }) => ({
        name,
        dueDate: format(addDays(today, days), "yyyy-MM-dd"),
    }))
