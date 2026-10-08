import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { describeDueStatus, getDaysUntilDue } from "./dueDates"
import { createSampleTasks, loadTasks, TASKS_STORAGE_KEY } from "./tasks"
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

// A local date and time; the sample due dates depend only on its calendar day.
const today = new Date(2026, 9, 8, 15, 30)
const sampleTasks = createSampleTasks(today)

const storageWith = (value: string | null): Pick<Storage, "getItem"> => ({
    getItem: (key) => key === TASKS_STORAGE_KEY ? value : null,
})

it("keeps TASKS_STORAGE_KEY compatible with existing saved tasks", () => {
    expect(TASKS_STORAGE_KEY).toBe("taskmanager.tasks")
})

describe("createSampleTasks", () => {
    const dueDates = (date: Date): string[] => createSampleTasks(date).map((task) => task.dueDate)

    it("dates the sample tasks relative to today's calendar date", () => {
        expect(createSampleTasks(today).map(({ text, dueDate }) => [text, dueDate])).toEqual([
            ["Deploy initial build", "2026-10-06"],
            ["Design UI", "2026-10-07"],
            ["Fix authentication bug", "2026-10-10"],
            ["Write documentation", "2026-10-18"],
            ["Deploy to production", "2026-10-29"],
        ])
    })

    it("gives the same dates at any time of day", () => {
        const expected = ["2026-10-06", "2026-10-07", "2026-10-10", "2026-10-18", "2026-10-29"]

        expect(dueDates(new Date(2026, 9, 8, 0, 0, 1))).toEqual(expected)
        expect(dueDates(new Date(2026, 9, 8, 23, 59, 59))).toEqual(expected)
    })

    it("counts calendar days across month, year and clock changes", () => {
        expect(dueDates(new Date(2026, 11, 31, 12))).toEqual(
            ["2026-12-29", "2026-12-30", "2027-01-02", "2027-01-10", "2027-01-21"],
        )
        // UK and US clocks both change within three weeks of this date.
        expect(dueDates(new Date(2026, 9, 24, 23, 30))).toEqual(
            ["2026-10-22", "2026-10-23", "2026-10-26", "2026-11-03", "2026-11-14"],
        )
    })

    it("starts with a completed task for Alice that was due 2 days ago", () => {
        const [first, second] = createSampleTasks(today)

        expect(first).toEqual({
            id: "task-5",
            text: "Deploy initial build",
            userId: "1",
            priority: 5,
            dueDate: "2026-10-06",
            completed: true,
        })
        expect(describeDueStatus(getDaysUntilDue(first.dueDate, today), first.completed)).toBe("Completed")
        expect(second.text).toBe("Design UI")
    })

    it("gives every sample task its own id", () => {
        const ids = createSampleTasks(today).map((task) => task.id)

        expect(new Set(ids).size).toBe(ids.length)
    })

    it("keeps the other sample task properties", () => {
        expect(createSampleTasks(today).map(({ dueDate, ...task }) => {
            void dueDate
            return task
        })).toEqual([
            { id: "task-5", text: "Deploy initial build", userId: "1", priority: 5, completed: true },
            { id: "task-1", text: "Design UI", userId: "1", priority: 4, completed: false },
            { id: "task-2", text: "Fix authentication bug", userId: "2", priority: 5, completed: false },
            { id: "task-3", text: "Write documentation", userId: "3", priority: 2, completed: false },
            { id: "task-4", text: "Deploy to production", userId: "1", priority: 3, completed: false },
        ])
    })

    it("creates a separate set each time, so a reset shares nothing with edited tasks", () => {
        const first = createSampleTasks(today)
        first[0].text = "Edited"
        first.pop()

        const second = createSampleTasks(today)

        expect(second).toHaveLength(5)
        expect(second[0].text).toBe("Deploy initial build")
        expect(second[0]).not.toBe(first[0])
    })

    it("re-dates a later set from the date it is created on", () => {
        const laterTasks = createSampleTasks(new Date(2026, 9, 20, 9))

        expect(laterTasks.map((task) => task.dueDate))
            .toEqual(["2026-10-18", "2026-10-19", "2026-10-22", "2026-10-30", "2026-11-10"])
    })

    it("creates tasks that load back unchanged once saved", () => {
        const saved = JSON.stringify(createSampleTasks(today))

        expect(loadTasks(storageWith(saved), new Date(2027, 5, 1))).toEqual(sampleTasks)
    })

    it("uses the current date when none is given", () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date(2027, 0, 15, 9))

        expect(createSampleTasks()[0].dueDate).toBe("2027-01-13")
        expect(loadTasks(storageWith(null))[2].dueDate).toBe("2027-01-17")

        vi.useRealTimers()
    })
})

describe("loadTasks", () => {
    beforeEach(() => {
        vi.spyOn(console, "warn").mockImplementation(() => undefined)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it("returns the sample tasks when no saved data exists", () => {
        expect(loadTasks(storageWith(null), today)).toEqual(sampleTasks)
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
        expect(loadTasks(storageWith("{"), today)).toEqual(sampleTasks)
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
        expect(loadTasks(storageWith(JSON.stringify(data)), today)).toEqual(sampleTasks)
        expect(console.warn).toHaveBeenCalled()
    })
})
