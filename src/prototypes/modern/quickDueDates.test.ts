import { describe, expect, it } from "vitest"
import type { TaskType } from "../../tasks"
import { createPrototypeTasks } from "../sampleTasks"
import { getQuickDueDates, updateTaskInList } from "./quickDueDates"

const valuesFor = (today: Date): string[] => getQuickDueDates(today).map(({ value }) => value)

describe("getQuickDueDates", () => {
    it("offers today, tomorrow and a week ahead in local yyyy-MM-dd form", () => {
        expect(getQuickDueDates(new Date(2026, 10, 5))).toEqual([
            { label: "Today", value: "2026-11-05", description: "Thu 5 Nov" },
            { label: "Tomorrow", value: "2026-11-06", description: "Fri 6 Nov" },
            { label: "In a week", value: "2026-11-12", description: "Thu 12 Nov" },
        ])
    })

    it("crosses a month end", () => {
        expect(valuesFor(new Date(2026, 9, 31))).toEqual(["2026-10-31", "2026-11-01", "2026-11-07"])
    })

    it("crosses the end of February in a leap year", () => {
        expect(valuesFor(new Date(2028, 1, 28))).toEqual(["2028-02-28", "2028-02-29", "2028-03-06"])
    })

    it("crosses a year end and adds the year to dates in the next year", () => {
        expect(getQuickDueDates(new Date(2026, 11, 31))).toEqual([
            { label: "Today", value: "2026-12-31", description: "Thu 31 Dec" },
            { label: "Tomorrow", value: "2027-01-01", description: "Fri 1 Jan 2027" },
            { label: "In a week", value: "2027-01-07", description: "Thu 7 Jan 2027" },
        ])
    })

    it("uses the local date late in the evening, not the UTC date", () => {
        expect(valuesFor(new Date(2026, 11, 31, 23, 59))).toEqual(["2026-12-31", "2027-01-01", "2027-01-07"])
    })

    it("counts calendar days across a daylight-saving change", () => {
        // Whatever the test machine's zone, a week on from 25 October is 1 November.
        expect(valuesFor(new Date(2026, 9, 25))[2]).toBe("2026-11-01")
    })
})

describe("updateTaskInList", () => {
    const tasks = createPrototypeTasks(new Date(2026, 10, 5))

    it("sets the chosen task's due date and leaves everything else as it was", () => {
        const [, tomorrow] = getQuickDueDates(new Date(2026, 10, 5))
        const target = tasks[5]
        const updated = updateTaskInList(tasks, target.id, { dueDate: tomorrow.value })

        expect(updated[5]).toEqual({ ...target, dueDate: "2026-11-06" })
        expect(updated.filter((_, index) => index !== 5)).toEqual(tasks.filter((_, index) => index !== 5))
        expect(updated.map(({ id }) => id)).toEqual(tasks.map(({ id }) => id))
    })

    it("does not change the original list or task", () => {
        const before: TaskType[] = structuredClone(tasks)

        updateTaskInList(tasks, tasks[0].id, { dueDate: "2027-01-07" })

        expect(tasks).toEqual(before)
    })

    it("clears a due date", () => {
        expect(updateTaskInList(tasks, tasks[0].id, { dueDate: "" })[0].dueDate).toBe("")
    })
})
