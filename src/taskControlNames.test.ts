import { describe, expect, it } from "vitest"
import { getTaskControlNames } from "./taskControlNames"

describe("task control names", () => {
    it("says what each control does first and which task it belongs to last", () => {
        expect(getTaskControlNames("Buy milk", 2)).toEqual({
            title: "Task title",
            dictationTarget: "Buy milk",
            dueDate: "Due date for Buy milk",
            priority: "Priority for Buy milk",
            assignee: "Assignee for Buy milk",
            completed: "Complete Buy milk",
            deleteButton: "Delete Buy milk",
        })
    })

    it("follows the title when it changes", () => {
        expect(getTaskControlNames("Buy oat milk", 2).deleteButton).toBe("Delete Buy oat milk")
    })

    it("leaves out spaces around the title", () => {
        expect(getTaskControlNames("  Buy milk ", 2).deleteButton).toBe("Delete Buy milk")
    })

    it("knows a task with a blank title by its position", () => {
        expect(getTaskControlNames("", 3)).toEqual({
            title: "Title of untitled task 3",
            dictationTarget: "untitled task 3",
            dueDate: "Due date for untitled task 3",
            priority: "Priority for untitled task 3",
            assignee: "Assignee for untitled task 3",
            completed: "Complete untitled task 3",
            deleteButton: "Delete untitled task 3",
        })
        expect(getTaskControlNames("   ", 1).deleteButton).toBe("Delete untitled task 1")
    })

    it("tells two tasks with blank titles apart", () => {
        const first = getTaskControlNames("", 1)
        const second = getTaskControlNames("", 2)

        for (const control of Object.keys(first) as (keyof typeof first)[]) {
            expect(first[control]).not.toBe(second[control])
        }
    })
})
