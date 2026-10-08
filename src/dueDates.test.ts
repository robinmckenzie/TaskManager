import { addDays, format } from "date-fns"
import { describe, expect, it } from "vitest"
import { describeDueStatus, getDaysUntilDue } from "./dueDates"
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

    it("counts the sample tasks as due yesterday and in 2, 10 and 21 days", () => {
        const now = new Date(2026, 9, 8, 15, 30)

        expect(createSampleTasks(now).map((task) => getDaysUntilDue(task.dueDate, now)))
            .toEqual([-1, 2, 10, 21])
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

    it("describes a completed task as completed whenever it was due", () => {
        expect(describeDueStatus(-5, true)).toBe("Completed")
        expect(describeDueStatus(0, true)).toBe("Completed")
        expect(describeDueStatus(4, true)).toBe("Completed")
    })
})
