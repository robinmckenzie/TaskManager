import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
    ASSIGNEE_FILTER_STORAGE_KEY,
    getVisibleTasks,
    loadAssigneeFilter,
    saveAssigneeFilter,
} from "./assigneeFilter"
import { createSampleTasks, reorderTasks } from "./tasks"

const users = [{ id: "1" }, { id: "2" }, { id: "3" }]
const tasks = [
    { ...createSampleTasks()[0], id: "A", completed: true },
    { ...createSampleTasks()[1], id: "B" },
    { ...createSampleTasks()[3], id: "C" },
]

describe("assignee filtering", () => {
    it("shows all tasks in order without changing the source", () => {
        const before = structuredClone(tasks)
        expect(getVisibleTasks(tasks, "")).toEqual(tasks.map((task, index) => ({ task, index })))
        expect(tasks).toEqual(before)
    })

    it("keeps completed and incomplete matches and their full-list indexes", () => {
        expect(getVisibleTasks(tasks, "1")).toEqual([
            { task: tasks[0], index: 0 },
            { task: tasks[2], index: 2 },
        ])
        expect(getVisibleTasks(tasks, "2")).toEqual([{ task: tasks[1], index: 1 }])
    })

    it("handles users with no tasks and empty task lists", () => {
        expect(getVisibleTasks(tasks, "3")).toEqual([])
        expect(getVisibleTasks([], "")).toEqual([])
        expect(getVisibleTasks([], "1")).toEqual([])
    })
})

describe("selection persistence", () => {
    beforeEach(() => {
        vi.spyOn(console, "warn").mockImplementation(() => undefined)
    })

    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    it.each([null, "", "missing"])("defaults %s to all assignees", (value) => {
        expect(loadAssigneeFilter(users, { getItem: () => value })).toBe("")
    })

    it("restores a saved selection independently of task storage", () => {
        const values = new Map<string, string>([["taskmanager.tasks", "[]"]])
        const storage = {
            getItem: (key: string) => values.get(key) ?? null,
            setItem: (key: string, value: string) => { values.set(key, value) },
        }
        saveAssigneeFilter("2", storage)
        expect(values.get(ASSIGNEE_FILTER_STORAGE_KEY)).toBe("2")
        expect(loadAssigneeFilter(users, storage)).toBe("2")
        expect(values.get("taskmanager.tasks")).toBe("[]")
    })

    it("falls back when the roster is empty", () => {
        expect(loadAssigneeFilter([], { getItem: () => "2" })).toBe("")
    })

    it("normalizes and saves an unavailable assignee", () => {
        const setItem = vi.fn()
        saveAssigneeFilter(loadAssigneeFilter(users, { getItem: () => "removed" }), { setItem })
        expect(setItem).toHaveBeenCalledWith(ASSIGNEE_FILTER_STORAGE_KEY, "")
    })

    it("tolerates read and write failures", () => {
        expect(loadAssigneeFilter(users, { getItem: () => { throw new Error("blocked") } })).toBe("")
        expect(() => saveAssigneeFilter("2", { setItem: () => { throw new Error("blocked") } })).not.toThrow()
        expect(console.warn).toHaveBeenCalledTimes(2)
    })

    it("tolerates unavailable browser storage", () => {
        vi.stubGlobal("localStorage", undefined)
        expect(loadAssigneeFilter(users)).toBe("")
        expect(() => saveAssigneeFilter("3")).not.toThrow()
    })
})

describe("filtered full-list reordering", () => {
    it("moves C above A without reversing A and hidden B", () => {
        const before = structuredClone(tasks)
        const visible = getVisibleTasks(tasks, "1")
        const reordered = reorderTasks(tasks, visible[1].index, visible[0].index)
        expect(reordered.map((task) => task.id)).toEqual(["C", "A", "B"])
        expect(reordered).toEqual([tasks[2], tasks[0], tasks[1]])
        expect(tasks).toEqual(before)
        expect(getVisibleTasks(reordered, "1").map(({ task, index }) => [task.id, index])).toEqual([["C", 0], ["A", 1]])
    })

    it("moves down across hidden tasks without changing task fields", () => {
        expect(reorderTasks(tasks, 0, 2)).toEqual([tasks[1], tasks[2], tasks[0]])
    })

    it("preserves empty lists and ignores absent sources", () => {
        expect(reorderTasks([], 0, 1)).toEqual([])
        expect(reorderTasks(tasks, 8, 0)).toBe(tasks)
    })
})
