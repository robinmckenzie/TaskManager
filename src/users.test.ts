import { describe, expect, it } from "vitest"
import { getNewTaskAssignee, sortAssigneesByName } from "./users"
import { getVisibleTasks } from "./assigneeFilter"
import { createSampleTasks } from "./tasks"

const users = [{ id: "1" }, { id: "2" }, { id: "3" }]

describe("assignee option ordering", () => {
    it("sorts an unsorted roster by name while preserving users and the creation default", () => {
        const roster = Object.freeze([
            Object.freeze({ id: "3", name: "Charlie" }),
            Object.freeze({ id: "1", name: "Alice" }),
            Object.freeze({ id: "2", name: "Bob" }),
        ])
        const sorted = sortAssigneesByName(roster)
        expect(sorted).toEqual([roster[1], roster[2], roster[0]])
        expect(roster.map((user) => user.id)).toEqual(["3", "1", "2"])
        expect(getNewTaskAssignee("", roster)).toBe("3")
        expect(getNewTaskAssignee("2", roster)).toBe("2")
    })

    it("uses names rather than IDs and handles mixed case", () => {
        expect(sortAssigneesByName([
            { id: "1", name: "Zoe" },
            { id: "2", name: "alice" },
            { id: "3", name: "Bob" },
        ]).map((user) => user.id)).toEqual(["2", "3", "1"])
    })

    it("retains every user with duplicate names and handles empty rosters", () => {
        const roster = [{ id: "2", name: "Alex" }, { id: "1", name: "Alex" }]
        expect(sortAssigneesByName(roster)).toEqual(roster)
        expect(sortAssigneesByName([])).toEqual([])
    })
})

describe("new-task assignment", () => {
    it.each(["1", "2", "3"])("uses selected user %s", (selection) => {
        const userId = getNewTaskAssignee(selection, users)
        expect(userId).toBe(selection)
        const newTask = { ...createSampleTasks()[0], userId }
        expect(getVisibleTasks([newTask], selection)).toEqual([{ task: newTask, index: 0 }])
    })

    it("retains the first-user default under all assignees or an invalid selection", () => {
        expect(getNewTaskAssignee("", users)).toBe("1")
        expect(getNewTaskAssignee("missing", users)).toBe("1")
    })

    it("retains the empty-ID fallback without users", () => {
        expect(getNewTaskAssignee("", [])).toBe("")
    })
})

it("falls back for a removed selected user even when the roster is empty", () => {
    expect(getNewTaskAssignee("removed", [])).toBe("")
})
