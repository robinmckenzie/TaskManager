import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import App from "./App"
import { ASSIGNEE_FILTER_STORAGE_KEY } from "./assigneeFilter"
import { TASKS_STORAGE_KEY } from "./tasks"

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

it("gives no task an inline animation, so that an overdue task does not pulse", () => {
    expect(markup).not.toContain("animation")
})

it("tells visitors that dictated text may be retained", () => {
    expect(markup).toContain('<p class="dictation-notice">This demo may retain dictated text for diagnostics.</p>')
})

const resetButton = '<button type="button" class="reset-tasks-button">Reset to sample tasks</button>'

it("offers resetting to the sample tasks as a button below the last task, with the assignee filter above the tasks", () => {
    const controls = markup.match(/<div class="task-list-controls">[\s\S]*?<div class="task /)?.[0]

    expect(controls).toContain('<label class="assignee-filter">')
    expect(controls).not.toContain("Reset to sample tasks")
    expect(markup.split(resetButton)).toHaveLength(2)
    expect(taskMarkup[4].endsWith(`${resetButton}</section></main>`)).toBe(true)
})

it.each([
    ["the list is empty", TASKS_STORAGE_KEY, "[]", "0 tasks"],
    ["the assignee filter matches no task", ASSIGNEE_FILTER_STORAGE_KEY, "4", "5 tasks"],
])("still offers resetting to the sample tasks, below the controls, when %s", (_view, savedKey, savedValue, taskCount) => {
    vi.stubGlobal("localStorage", {
        getItem: (key: string): string | null => (key === savedKey ? savedValue : null),
    })
    const emptyMarkup = renderToStaticMarkup(createElement(App))

    expect(emptyMarkup).not.toContain('<div class="task ')
    expect(emptyMarkup).toContain(taskCount)
    expect(emptyMarkup.split(resetButton)).toHaveLength(2)
    expect(emptyMarkup.endsWith(`</div>${resetButton}</section></main>`)).toBe(true)
})

it("names each control on a task card after what it does and its task", () => {
    const [first, second] = taskMarkup

    for (const name of [
        "Task title",
        "Start dictation into Deploy initial build",
        "Due date for Deploy initial build",
        "Priority for Deploy initial build",
        "Assignee for Deploy initial build",
        "Complete Deploy initial build",
        "Delete Deploy initial build",
    ]) {
        expect(first).toContain(`aria-label="${name}"`)
    }

    expect(first).toContain('aria-valuetext="5 of 5"')
    expect(second).toContain('aria-label="Delete Design UI"')
})

it("says how to dictate, with the button's microphone in place of the word", () => {
    const hint = markup.match(/<p class="dictation-hint">([\s\S]*?)<\/p>/)?.[1]
    const buttonIcon = taskMarkup[0].match(/<path[^>]*>/)?.[0]

    expect(hint?.replace(/<svg[^>]*role="img" aria-label="microphone"[^>]*>[\s\S]*?<\/svg>/, "[microphone]").replace("<br/>", " ").replace(/<\/?span>/g, "")).toBe(
        "Dictate a task title: click its [microphone] button, or click a title and press Ctrl + Alt. These both toggle the mic on/off.",
    )
    expect(hint).toContain("button,</span> <span>or click a title and press Ctrl + Alt.</span><br/>These both")
    expect(buttonIcon).toBeDefined()
    expect(hint).toContain(buttonIcon)
    expect(hint).not.toContain("<button")
})

it("starts with an empty dictation status and the horizontal bar selected", () => {
    expect(markup).toContain('<p class="dictation-status" role="status"></p>')
    expect(markup).not.toContain("level-meter")
    expect(markup).toContain('<button type="button" aria-pressed="true">Horizontal bar</button>')
    expect(markup).toContain('<button type="button" aria-pressed="false">Analogue needle</button>')
    expect(markup).toContain('<button type="button" aria-pressed="false">Waveform</button>')
})

it("offers only the looks of the selected meter style", () => {
    const looks = markup.match(/<div class="meter-looks"[\s\S]*?<\/div>/)?.[0]

    expect(looks).toContain('aria-label="Horizontal bar look"')
    expect(looks?.match(/<button[^>]*>[^<]*/g)).toEqual([
        '<button type="button" aria-pressed="true">Solid',
        '<button type="button" aria-pressed="false">Segments',
        '<button type="button" aria-pressed="false">Gradient',
    ])
    expect(markup).not.toContain("Classic")
    expect(markup).not.toContain("Pill")
})
