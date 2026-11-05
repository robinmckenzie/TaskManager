import { describe, expect, it } from "vitest"
import { createPrototypeTasks } from "../sampleTasks"
import { describeCountdown, formatDueDate, getQuickDueDates } from "./docket"

const today = new Date(2026, 10, 5)

describe("describeCountdown", () => {
    it("describes every sample task", () => {
        const countdowns = createPrototypeTasks(today).map((task) => describeCountdown(task, today))

        expect(countdowns).toEqual([
            { state: "overdue", label: "Overdue", figure: "2", unit: "days" },
            { state: "due-soon", label: "Due", figure: "Today", unit: "" },
            { state: "due-soon", label: "Due in", figure: "1", unit: "day" },
            { state: "due-this-week", label: "Due in", figure: "3", unit: "days" },
            { state: "due-later", label: "Due in", figure: "10", unit: "days" },
            { state: "no-due-date", label: "No date", figure: "–", unit: "" },
            { state: "completed", label: "Done", figure: "", unit: "" },
        ])
    })

    it("uses the singular for one day overdue", () => {
        expect(describeCountdown({ dueDate: "2026-11-04", completed: false }, today)).toMatchObject({
            label: "Overdue",
            figure: "1",
            unit: "day",
        })
    })
})

describe("formatDueDate", () => {
    it("gives the weekday, day and month this year", () => {
        expect(formatDueDate("2026-11-03", today)).toBe("Tue 3 Nov")
    })

    it("adds the year for another year", () => {
        expect(formatDueDate("2027-01-04", today)).toBe("Mon 4 Jan 2027")
    })

    it("is empty without a due date", () => {
        expect(formatDueDate("", today)).toBe("")
    })
})

describe("getQuickDueDates", () => {
    it("offers today, tomorrow and a week ahead, across a year end", () => {
        expect(getQuickDueDates(new Date(2026, 11, 31))).toEqual([
            { label: "Today", value: "2026-12-31" },
            { label: "Tomorrow", value: "2027-01-01" },
            { label: "In a week", value: "2027-01-07" },
        ])
    })
})
