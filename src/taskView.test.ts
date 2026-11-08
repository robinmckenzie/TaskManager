import { describe, expect, it } from "vitest"
import { describeTaskSummary, describeTaskView } from "./taskView"

describe("describeTaskView", () => {
    it.each([
        [0, "0 tasks"],
        [1, "1 task"],
        [7, "7 tasks"],
    ])("counts %i tasks in the unfiltered view as %s", (total, count) => {
        expect(describeTaskView(undefined, total, total)).toEqual({
            heading: "All tasks",
            count,
            emptyMessage: null,
        })
    })

    it("names the person and counts the tasks shown against all of them when filtered", () => {
        expect(describeTaskView("Bob", 2, 7)).toEqual({
            heading: "Bob's tasks",
            count: "2 of 7 tasks",
            emptyMessage: null,
        })
    })

    it("says a filter has no tasks, and counts them as none of the total", () => {
        expect(describeTaskView("Aaron", 0, 7)).toEqual({
            heading: "Aaron's tasks",
            count: "0 of 7 tasks",
            emptyMessage: "No tasks for Aaron.",
        })
    })

    it("uses the singular when the only task in all belongs to someone else", () => {
        expect(describeTaskView("Bob", 0, 1).count).toBe("0 of 1 task")
        expect(describeTaskView("Bob", 1, 1).count).toBe("1 of 1 task")
    })

    it("gives no empty message for an unfiltered empty list", () => {
        expect(describeTaskView(undefined, 0, 0).emptyMessage).toBeNull()
    })
})

describe("describeTaskSummary", () => {
    it("lists overdue, due soon and completed in that order", () => {
        expect(describeTaskSummary({ overdue: 1, dueSoon: 2, completed: 1 })).toBe(
            "1 overdue · 2 due soon · 1 completed",
        )
    })

    it("leaves out each category that has no tasks", () => {
        expect(describeTaskSummary({ overdue: 0, dueSoon: 2, completed: 0 })).toBe("2 due soon")
        expect(describeTaskSummary({ overdue: 3, dueSoon: 0, completed: 1 })).toBe("3 overdue · 1 completed")
    })

    it("gives an empty string when nothing is overdue, due soon or completed", () => {
        expect(describeTaskSummary({ overdue: 0, dueSoon: 0, completed: 0 })).toBe("")
    })
})
