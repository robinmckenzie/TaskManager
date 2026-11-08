import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it, vi } from "vitest"
import { TaskDetails } from "./TaskDetails"
import { getQuickDueDates } from "./quickDueDates"
import { getTaskControlNames } from "./taskControlNames"
import type { TaskType } from "./tasks"

const users = [
    { id: "1", name: "Alice", photo: "photo.png" },
    { id: "2", name: "Bob", photo: "photo.png" },
]

const task: TaskType = {
    id: "t1",
    text: "Prepare sprint demo",
    userId: "2",
    priority: 4,
    dueDate: "2026-11-09",
    completed: false,
}

const render = (overrides: Partial<TaskType> = {}, position = 1): string => {
    const shown = { ...task, ...overrides }

    return renderToStaticMarkup(
        createElement(TaskDetails, {
            task: shown,
            panelId: "task-details-t1",
            names: getTaskControlNames(shown.text, position),
            users,
            quickDueDates: getQuickDueDates(new Date(2026, 10, 8, 23, 30)),
            focusField: null,
            updateTask: vi.fn(),
            changeAssignee: vi.fn(),
            deleteTask: vi.fn(),
            onClose: vi.fn(),
        }),
    )
}

it("names each control after what it does and its task", () => {
    const markup = render()

    for (const name of [
        "Details for Prepare sprint demo",
        "Due date for Prepare sprint demo",
        "Priority for Prepare sprint demo",
        "Assignee for Prepare sprint demo",
        "Delete Prepare sprint demo",
    ]) {
        expect(markup).toContain(`aria-label="${name}"`)
    }
})

it("names the quick dates with their date and task, from the date the app follows", () => {
    const markup = render()

    expect(markup).toContain('aria-label="Today, 8 Nov, for Prepare sprint demo"')
    expect(markup).toContain('aria-label="Tomorrow, 9 Nov, for Prepare sprint demo"')
    expect(markup).toContain('aria-label="In a week, 15 Nov, for Prepare sprint demo"')
    expect(markup).not.toContain("No date")
})

it("shows only the quick date matching the due date as pressed", () => {
    const pressed = (markup: string): string[] =>
        [...markup.matchAll(/aria-pressed="true"[^>]*>([^<]*)</g)].map((match) => match[1])

    expect(pressed(render({ dueDate: "2026-11-09" }))).toEqual(["Tomorrow"])
    expect(pressed(render({ dueDate: "2026-11-15" }))).toEqual(["In a week"])
    expect(pressed(render({ dueDate: "" }))).toEqual([])
    expect(pressed(render({ dueDate: "not a date" }))).toEqual([])
})

it("exposes the selected priority and assignee as radio buttons", () => {
    const markup = render()
    const checked = [...markup.matchAll(/<input[^>]*name="([a-z]+)-t1"[^>]*checked=""/g)]

    expect(checked.map((match) => match[1])).toEqual(["priority", "assignee"])
    expect(markup).toContain('role="radiogroup" aria-label="Priority for Prepare sprint demo"')
    expect(markup).toContain('aria-label="1 of 5, lowest"')
    expect(markup).toContain('aria-label="5 of 5, highest"')
    expect(markup).toContain("<span>Alice</span>")
    expect(markup).toContain("<span>Bob</span>")
})

it("keeps blank tasks distinguishable by their position", () => {
    const markup = render({ text: "  " }, 3)

    expect(markup).toContain('aria-label="Delete untitled task 3"')
    expect(markup).toContain('aria-label="Today, 8 Nov, for untitled task 3"')
})

it("checks no priority for a saved priority outside 1 to 5", () => {
    expect(render({ priority: 9 })).not.toMatch(/<input[^>]*name="priority-t1"[^>]*checked/)
})
