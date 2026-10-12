import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import App from "./App"
import { TASKS_STORAGE_KEY } from "./tasks"
import type { TaskType } from "./tasks"

const savedTasks: TaskType[] = [
    { id: "saved-1", text: "No date yet", userId: "1", priority: 3, dueDate: "", completed: false },
    { id: "saved-2", text: "Done without a date", userId: "2", priority: 2, dueDate: "", completed: true },
]

let taskMarkup: string[]

beforeEach(() => {
    vi.stubGlobal("localStorage", {
        getItem: (key: string) => key === TASKS_STORAGE_KEY ? JSON.stringify(savedTasks) : null,
    })
    taskMarkup = renderToStaticMarkup(createElement(App)).split('<div class="task ').slice(1)
})

afterEach(() => {
    vi.unstubAllGlobals()
})

it("loads saved tasks that have an empty due date", () => {
    expect(taskMarkup).toHaveLength(2)
    expect(taskMarkup[0]).toContain('value="No date yet"')
    expect(taskMarkup[1]).toContain('value="Done without a date"')
})

it("shows an incomplete task with no due date as having none, in the neutral colour", () => {
    const [incomplete] = taskMarkup

    expect(incomplete.startsWith('task-normal"')).toBe(true)
    expect(incomplete).toContain("<span>No due date</span>")
    expect(incomplete).not.toContain("animation")
    expect(incomplete).not.toContain("NaN")
})

it("shows a completed task with no due date as completed", () => {
    const [, completed] = taskMarkup

    expect(completed.startsWith('task-completed"')).toBe(true)
    expect(completed).toContain("<span>Completed</span>")
    expect(completed).not.toContain("NaN")
})
