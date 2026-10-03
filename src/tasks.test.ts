import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { initialTasks, loadTasks, TASKS_STORAGE_KEY } from "./tasks"
import type { TaskType } from "./tasks"

const savedTasks: TaskType[] = [
    {
        id: "saved-2",
        text: "Review changes",
        userId: "3",
        priority: 1,
        dueDate: "2026-11-02",
        completed: true,
    },
    {
        id: "saved-1",
        text: "Add persistence tests",
        userId: "2",
        priority: 5,
        dueDate: "2026-10-15",
        completed: false,
    },
]

const storageWith = (value: string | null): Pick<Storage, "getItem"> => ({
    getItem: (key) => key === TASKS_STORAGE_KEY ? value : null,
})

it("keeps TASKS_STORAGE_KEY compatible with existing saved tasks", () => {
    expect(TASKS_STORAGE_KEY).toBe("taskmanager.tasks")
})

describe("loadTasks", () => {
    beforeEach(() => {
        vi.spyOn(console, "warn").mockImplementation(() => undefined)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it("returns the sample tasks when no saved data exists", () => {
        expect(loadTasks(storageWith(null))).toEqual(initialTasks)
        expect(console.warn).not.toHaveBeenCalled()
    })

    it("restores valid saved tasks with their fields and order", () => {
        expect(loadTasks(storageWith(JSON.stringify(savedTasks)))).toEqual(savedTasks)
        expect(console.warn).not.toHaveBeenCalled()
    })

    it("keeps an empty saved task list empty", () => {
        expect(loadTasks(storageWith("[]"))).toEqual([])
        expect(console.warn).not.toHaveBeenCalled()
    })

    it("falls back to sample tasks when saved JSON is malformed", () => {
        expect(loadTasks(storageWith("{"))).toEqual(initialTasks)
        expect(console.warn).toHaveBeenCalled()
    })

    it.each([
        { description: "null", data: null },
        { description: "a non-array object", data: {} },
        { description: "a null task entry", data: [null] },
        { description: "missing task fields", data: [{ id: "partial" }] },
        {
            description: "mixed valid and invalid tasks",
            data: [savedTasks[0], { id: "partial" }],
        },
        ...Object.entries({
            id: 123,
            text: false,
            userId: [],
            priority: "high",
            dueDate: null,
            completed: "yes",
        }).map(([field, value]) => ({
            description: `an incorrect ${field} type`,
            data: [{ ...savedTasks[0], [field]: value }],
        })),
    ])("falls back to sample tasks for $description", ({ data }) => {
        expect(loadTasks(storageWith(JSON.stringify(data)))).toEqual(initialTasks)
        expect(console.warn).toHaveBeenCalled()
    })
})
