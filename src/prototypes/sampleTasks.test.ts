import { describe, expect, it } from "vitest"
import { createPrototypeTasks, getTaskState, prototypeUsers } from "./sampleTasks"
import type { TaskState } from "./sampleTasks"

const ALL_STATES: TaskState[] = ["completed", "overdue", "due-soon", "due-this-week", "due-later", "no-due-date"]

describe("prototype sample tasks", () => {
    // A late-evening time, a month end and a year end, so that the relative
    // dates are checked across boundaries.
    it.each([
        new Date(2026, 10, 5, 9, 0),
        new Date(2026, 10, 30, 23, 59),
        new Date(2026, 11, 31, 12, 0),
    ])("include every task state on %s", (today) => {
        const states = createPrototypeTasks(today).map((task) => getTaskState(task, today))

        expect(new Set(states)).toEqual(new Set(ALL_STATES))
    })

    it("use every priority and every assignee", () => {
        const tasks = createPrototypeTasks(new Date(2026, 10, 5))

        expect(new Set(tasks.map((task) => task.priority))).toEqual(new Set([1, 2, 3, 4, 5]))
        expect(new Set(tasks.map((task) => task.userId))).toEqual(new Set(prototypeUsers.map((user) => user.id)))
    })

    it("give each task a unique id", () => {
        const ids = createPrototypeTasks().map((task) => task.id)

        expect(new Set(ids).size).toBe(ids.length)
    })
})

describe("getTaskState", () => {
    const today = new Date(2026, 10, 5, 15, 0)

    it.each<[string, boolean, TaskState]>([
        ["2026-11-04", false, "overdue"],
        ["2026-11-05", false, "due-soon"],
        ["2026-11-06", false, "due-soon"],
        ["2026-11-07", false, "due-this-week"],
        ["2026-11-08", false, "due-this-week"],
        ["2026-11-09", false, "due-later"],
        ["", false, "no-due-date"],
        ["2026-11-01", true, "completed"],
    ])("treats %s (completed: %s) as %s, as the app does", (dueDate, completed, expected) => {
        expect(getTaskState({ dueDate, completed }, today)).toBe(expected)
    })
})
