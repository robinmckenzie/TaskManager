import { describe, expect, it } from "vitest"
import { getVisibleTasks } from "./assigneeFilter"
import { findTaskToFocusAfterDelete } from "./focusAfterDelete"
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
        // Alice has the first, second and last sample tasks.
        const tasks = createSampleTasks()
        const aliceTaskIds = getVisibleTasks(tasks, "1").map(({ task }) => task.id)

        expect(aliceTaskIds).toEqual([tasks[0].id, tasks[1].id, tasks[4].id])
        expect(findTaskToFocusAfterDelete(aliceTaskIds, tasks[1].id)).toBe(tasks[4].id)
        expect(findTaskToFocusAfterDelete(aliceTaskIds, tasks[4].id)).toBe(tasks[1].id)
    })
})
