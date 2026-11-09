import { describe, expect, it } from "vitest"
import { getVisibleTasks } from "./assigneeFilter"
import { findTaskToFocusAfterDelete, findTaskToFocusAfterHidden } from "./focusAfterDelete"
import { createSampleTasks } from "./tasks"

describe("focus after deleting a task", () => {
    const visible = ["A", "B", "C"]

    it("goes to the next task when the first or a middle task is deleted", () => {
        expect(findTaskToFocusAfterDelete(visible, "A")).toBe("B")
        expect(findTaskToFocusAfterDelete(visible, "B")).toBe("C")
    })

    it("goes to the previous task when the last task is deleted", () => {
        expect(findTaskToFocusAfterDelete(visible, "C")).toBe("B")
    })

    it("has no task to go to when the only task on show is deleted", () => {
        expect(findTaskToFocusAfterDelete(["A"], "A")).toBeUndefined()
    })

    it("has no task to go to for a task that is not on show", () => {
        expect(findTaskToFocusAfterDelete(visible, "D")).toBeUndefined()
    })

    it("skips tasks hidden by the assignee filter", () => {
        // Bob has the first and last sample tasks, with the others between them.
        const tasks = createSampleTasks()
        const bobTaskIds = getVisibleTasks(tasks, "2").map(({ task }) => task.id)

        expect(bobTaskIds).toEqual([tasks[0].id, tasks[6].id])
        expect(findTaskToFocusAfterDelete(bobTaskIds, tasks[0].id)).toBe(tasks[6].id)
        expect(findTaskToFocusAfterDelete(bobTaskIds, tasks[6].id)).toBe(tasks[0].id)
    })
})

describe("focus after a filter hides a task", () => {
    const all = ["A", "B", "C", "D"]

    it("goes to the next task still on show", () => {
        expect(findTaskToFocusAfterHidden(all, ["A", "C"], "B")).toBe("C")
    })

    it("goes to the previous task still on show when none follows", () => {
        expect(findTaskToFocusAfterHidden(all, ["A", "B"], "D")).toBe("B")
    })

    it("has no task to go to when nothing is on show", () => {
        expect(findTaskToFocusAfterHidden(all, [], "B")).toBeUndefined()
    })

    it("has no task to go to for an unknown task", () => {
        expect(findTaskToFocusAfterHidden(all, ["A"], "Z")).toBeUndefined()
    })
})
