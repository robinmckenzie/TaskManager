import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, expect, it, vi } from "vitest"
import App from "./App"
import { TASKS_STORAGE_KEY } from "./tasks"

const renderRows = (savedTasks: unknown[] | null): string[] => {
    vi.stubGlobal("localStorage", {
        getItem: (key: string) =>
            key === TASKS_STORAGE_KEY && savedTasks !== null ? JSON.stringify(savedTasks) : null,
    })

    return renderToStaticMarkup(createElement(App)).split('<div class="task ').slice(1)
}

const savedTask = (overrides: Record<string, unknown>): Record<string, unknown> => ({
    id: "saved-1",
    text: "A task",
    userId: "1",
    priority: 3,
    dueDate: "2026-11-06",
    completed: false,
    ...overrides,
})

afterEach(() => {
    vi.unstubAllGlobals()
})

it("shows each sample task's due state with its own icon, and a short date unless there is no due date", () => {
    const rows = renderRows(null)
    const dueOf = (row: string): string => row.match(/<span id="[^"]*" class="task-due [\s\S]*?<\/span><\/span>/)?.[0] ?? ""

    const kinds = rows.map((row) => row.match(/task-due task-due-([a-z-]+)"/)?.[1])
    const icons = rows.map((row) => dueOf(row).match(/<path d="([^"]{0,60})/)?.[1])

    expect(new Set(kinds)).toEqual(new Set(["overdue", "due-soon", "due-this-week", "later", "none", "completed"]))
    // Six states, six different shapes: colour is never the only signal.
    expect(new Set(icons).size).toBe(6)

    rows.forEach((row, position) => {
        expect(dueOf(row).includes("task-due-date")).toBe(kinds[position] !== "none")
    })
})

it("shows a saved task with an unusable due date, with no short date", () => {
    const [row] = renderRows([savedTask({ dueDate: "not a date" })])

    expect(row).toContain("task-due-none")
    expect(row).toContain("No due date")
    expect(row).not.toContain("task-due-date")
})

it("shows a completed task with an unusable due date as completed, with no short date", () => {
    const [row] = renderRows([savedTask({ dueDate: "2026-02-30", completed: true })])

    expect(row).toContain("task-due-completed")
    expect(row).not.toContain("task-due-date")
})

it("keeps the grip and the microphone button in every row", () => {
    const rows = renderRows(null)

    for (const row of rows) {
        expect(row).toContain('class="task-grip"')
        expect(row).toContain('class="dictation-button')
    }
})

it("shows a priority outside 1 to 5 without breaking the row", () => {
    const [row] = renderRows([savedTask({ priority: 9 })])

    expect(row).toContain('<span class="task-priority-number" aria-hidden="true">9</span>')
    expect(row.match(/priority-bar-on/g)).toHaveLength(5)
})

it("labels the columns above the rows", () => {
    vi.stubGlobal("localStorage", { getItem: () => null })

    const markup = renderToStaticMarkup(createElement(App))
    const labels = markup.match(/<div class="task-columns"[^>]*>(.*?)<\/div>/)?.[1].replace(/<[^>]+>/g, " ").trim()

    expect(labels).toBe("Task  Due  Priority  Assignee")
    expect(markup.indexOf("task-columns")).toBeLessThan(markup.indexOf('<div class="task '))
})
