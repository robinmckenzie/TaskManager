import { describe, expect, it } from "vitest"
import { summariseTasks } from "./taskSummary"
import type { TaskType } from "./tasks"

const today = new Date(2026, 10, 8, 15, 30)

let nextId = 0
const makeTask = (dueDate: string, completed = false, userId = "1"): TaskType => ({
    id: `t${nextId++}`,
    text: "Task",
    userId,
    priority: 3,
    dueDate,
    completed,
})

describe("summariseTasks", () => {
    it("gives three zeroes for no tasks", () => {
        expect(summariseTasks([], today)).toEqual({ overdue: 0, dueSoon: 0, completed: 0 })
    })

    it("counts a mix of states", () => {
        const tasks = [
            makeTask("2026-11-07"), // overdue
            makeTask("2026-11-01"), // overdue
            makeTask("2026-11-08"), // due today
            makeTask("2026-11-09"), // due tomorrow
            makeTask("2026-11-10"), // due this week
            makeTask("2026-11-11"), // due this week
            makeTask("2026-11-12"), // later
            makeTask(""), // no date
            makeTask("not a date"), // unusable
            makeTask("2026-11-20", true),
        ]

        expect(summariseTasks(tasks, today)).toEqual({ overdue: 2, dueSoon: 2, completed: 1 })
    })

    it("counts completed tasks only as completed, however they are dated", () => {
        const tasks = [
            makeTask("2026-11-01", true), // past due
            makeTask("2026-11-08", true), // due today
            makeTask("2026-11-09", true), // due tomorrow
            makeTask("2026-12-01", true),
            makeTask("", true),
            makeTask("not a date", true),
        ]

        expect(summariseTasks(tasks, today)).toEqual({ overdue: 0, dueSoon: 0, completed: 6 })
    })

    it("does not count tasks that are later, undated or due this week", () => {
        const tasks = [makeTask("2026-11-10"), makeTask("2026-11-11"), makeTask("2026-11-12"), makeTask("")]

        expect(summariseTasks(tasks, today)).toEqual({ overdue: 0, dueSoon: 0, completed: 0 })
    })

    it("summarises a subset, such as one person's tasks", () => {
        const tasks = [
            makeTask("2026-11-07", false, "1"),
            makeTask("2026-11-08", false, "2"),
            makeTask("2026-11-01", true, "2"),
            makeTask("2026-11-09", false, "2"),
        ]
        const persons = tasks.filter((task) => task.userId === "2")

        expect(summariseTasks(persons, today)).toEqual({ overdue: 0, dueSoon: 2, completed: 1 })
    })

    it("follows the today it is given", () => {
        const tasks = [makeTask("2026-11-08")]

        expect(summariseTasks(tasks, new Date(2026, 10, 8, 23, 59))).toEqual({ overdue: 0, dueSoon: 1, completed: 0 })
        expect(summariseTasks(tasks, new Date(2026, 10, 9, 0, 1))).toEqual({ overdue: 1, dueSoon: 0, completed: 0 })
    })

    it("does not change the tasks it is given", () => {
        const tasks = [makeTask("2026-11-07"), makeTask("2026-11-08", true)]
        const before = JSON.stringify(tasks)

        summariseTasks(tasks, today)

        expect(JSON.stringify(tasks)).toBe(before)
    })
})
