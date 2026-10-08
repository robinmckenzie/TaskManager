import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import App from "./App"

let taskMarkup: string[]
let markup: string

beforeEach(() => {
    vi.stubGlobal("localStorage", { getItem: () => null })
    markup = renderToStaticMarkup(createElement(App))
    taskMarkup = markup.split('<div class="task ').slice(1)
})

afterEach(() => {
    vi.unstubAllGlobals()
})

it("shows the completed sample task first, styled as completed and not as overdue", () => {
    const [first, second] = taskMarkup

    expect(taskMarkup).toHaveLength(5)
    expect(first).toContain('value="Deploy initial build"')
    expect(first.startsWith("task-completed")).toBe(true)
    expect(first).toContain("Completed")
    expect(first).not.toContain("overdue")
    expect(first).toContain('alt="Alice"')
    expect(first).toContain("Priority: 5/5")

    expect(second).toContain('value="Design UI"')
    expect(second.startsWith("task-overdue")).toBe(true)
    expect(second).toContain("1 day overdue")
})

it("offers resetting to the sample tasks as a button beside the assignee filter", () => {
    const controls = markup.match(/<div class="task-list-controls">[\s\S]*?<\/div>/)?.[0]

    expect(controls).toContain('<label class="assignee-filter">')
    expect(controls).toMatch(/<button type="button" class="reset-tasks-button">Reset to sample tasks<\/button>/)
})
