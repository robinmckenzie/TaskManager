import { addDays, format } from "date-fns"
import { describe, expect, it } from "vitest"
import { describeDueStatus, formatShortDate, getDaysUntilDue, getDueState } from "./dueDates"
import { createSampleTasks } from "./tasks"

const toDueDate = (date: Date): string => format(date, "yyyy-MM-dd")

describe("getDaysUntilDue", () => {
    it.each([
        { offset: -1, description: "yesterday" },
        { offset: 0, description: "today" },
        { offset: 1, description: "tomorrow" },
        { offset: 2, description: "in 2 days" },
        { offset: 10, description: "in 10 days" },
        { offset: 21, description: "in 21 days" },
    ])("counts a task due $description as $offset at any time of day", ({ offset }) => {
        for (const [hours, minutes, seconds] of [[0, 0, 0], [9, 30, 0], [15, 30, 0], [23, 59, 59]]) {
            const now = new Date(2026, 9, 8, hours, minutes, seconds)

            expect(getDaysUntilDue(toDueDate(addDays(now, offset)), now)).toBe(offset)
        }
    })

    it("counts calendar days across month and year boundaries", () => {
        expect(getDaysUntilDue("2026-11-01", new Date(2026, 9, 31, 23, 30))).toBe(1)
        expect(getDaysUntilDue("2027-01-02", new Date(2026, 11, 31, 18))).toBe(2)
        expect(getDaysUntilDue("2026-12-31", new Date(2027, 0, 1, 0, 5))).toBe(-1)
        expect(getDaysUntilDue("2028-03-01", new Date(2028, 1, 28, 12))).toBe(2)
    })

    it("counts calendar days across daylight-saving changes", () => {
        // Clocks change on these dates in the UK or the US; elsewhere they are ordinary days.
        expect(getDaysUntilDue("2026-10-26", new Date(2026, 9, 24, 23, 30))).toBe(2)
        expect(getDaysUntilDue("2026-11-02", new Date(2026, 9, 31, 23, 30))).toBe(2)
        expect(getDaysUntilDue("2027-03-29", new Date(2027, 2, 27, 0, 30))).toBe(2)
        expect(getDaysUntilDue("2027-03-15", new Date(2027, 2, 13, 23, 30))).toBe(2)
        expect(getDaysUntilDue("2026-10-24", new Date(2026, 9, 26, 0, 30))).toBe(-2)
    })

    it("uses the current date when none is given", () => {
        expect(getDaysUntilDue(toDueDate(addDays(new Date(), 3)))).toBe(3)
    })

    it("counts no days for a task with no due date", () => {
        expect(getDaysUntilDue("", new Date(2026, 9, 8, 15, 30))).toBeNull()
        expect(getDaysUntilDue("")).toBeNull()
    })

    it("counts no days for a due date that is not a date", () => {
        expect(getDaysUntilDue("not a date", new Date(2026, 9, 8, 15, 30))).toBeNull()
    })

    it("counts a day fewer once the day changes", () => {
        expect(getDaysUntilDue("2026-10-09", new Date(2026, 9, 8, 23, 59, 59))).toBe(1)
        expect(getDaysUntilDue("2026-10-09", new Date(2026, 9, 9, 0, 0, 0))).toBe(0)
    })

    it("counts the sample tasks as due 2 days ago, today, in 1, 3 and 10 days, never, and 3 days ago", () => {
        const now = new Date(2026, 9, 8, 15, 30)

        expect(createSampleTasks(now).map((task) => getDaysUntilDue(task.dueDate, now)))
            .toEqual([-2, 0, 1, 3, 10, null, -3])
    })
})

describe("describeDueStatus", () => {
    it.each([
        [-3, "3 days overdue"],
        [-1, "1 day overdue"],
        [0, "Due today"],
        [1, "1 day remaining"],
        [2, "2 days remaining"],
        [10, "10 days remaining"],
        [21, "21 days remaining"],
    ])("describes %i days until due as %s", (daysUntilDue, expected) => {
        expect(describeDueStatus(daysUntilDue, false)).toBe(expected)
    })

    it("describes an incomplete task with no due date as having none", () => {
        expect(describeDueStatus(null, false)).toBe("No due date")
    })

    it("describes a completed task as completed whenever it was due", () => {
        expect(describeDueStatus(null, true)).toBe("Completed")
        expect(describeDueStatus(-5, true)).toBe("Completed")
        expect(describeDueStatus(0, true)).toBe("Completed")
        expect(describeDueStatus(4, true)).toBe("Completed")
    })
})

describe("getDueState", () => {
    const now = new Date(2026, 9, 8, 15, 30)
    const dueIn = (days: number): string => toDueDate(addDays(now, days))

    it.each([
        { days: -1, kind: "overdue" },
        { days: 0, kind: "due-soon" },
        { days: 1, kind: "due-soon" },
        { days: 2, kind: "due-this-week" },
        { days: 3, kind: "due-this-week" },
        { days: 4, kind: "later" },
        { days: 21, kind: "later" },
    ])("puts an incomplete task due in $days days in $kind", ({ days, kind }) => {
        expect(getDueState(dueIn(days), false, now)).toEqual({ kind, daysUntilDue: days })
    })

    it("has no due state for a missing or unusable date", () => {
        expect(getDueState("", false, now)).toEqual({ kind: "none", daysUntilDue: null })
        expect(getDueState("not a date", false, now)).toEqual({ kind: "none", daysUntilDue: null })
    })

    it.each([
        { description: "past", dueDate: dueIn(-5), daysUntilDue: -5 },
        { description: "future", dueDate: dueIn(5), daysUntilDue: 5 },
        { description: "empty", dueDate: "", daysUntilDue: null },
        { description: "unusable", dueDate: "not a date", daysUntilDue: null },
    ])("puts a completed task with a $description date in completed", ({ dueDate, daysUntilDue }) => {
        expect(getDueState(dueDate, true, now)).toEqual({ kind: "completed", daysUntilDue })
    })

    it("applies the thresholds across a month end and a year end", () => {
        expect(getDueState("2026-11-01", false, new Date(2026, 9, 31, 23, 30)).kind).toBe("due-soon")
        expect(getDueState("2027-01-02", false, new Date(2026, 11, 31, 18)).kind).toBe("due-this-week")
        expect(getDueState("2026-12-31", false, new Date(2027, 0, 1, 0, 5)).kind).toBe("overdue")
    })

    it("keeps the day count that the wording uses", () => {
        const { daysUntilDue } = getDueState(dueIn(2), false, now)

        expect(describeDueStatus(daysUntilDue, false)).toBe("2 days remaining")
    })
})

describe("formatShortDate", () => {
    it.each([
        { dueDate: "2026-11-06", expected: "6 Nov" },
        { dueDate: "2026-01-31", expected: "31 Jan" },
        { dueDate: "2028-02-29", expected: "29 Feb" },
    ])("words $dueDate as $expected", ({ dueDate, expected }) => {
        expect(formatShortDate(dueDate)).toBe(expected)
    })

    it.each(["", "not a date", "2026-13-45", "2026-02-30"])(
        "gives nothing for the unusable due date %j, as it does not throw",
        (dueDate) => {
            expect(formatShortDate(dueDate)).toBe("")
        },
    )
})
