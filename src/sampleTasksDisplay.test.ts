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

it("tells visitors that dictated text may be retained", () => {
    expect(markup).toContain('<p class="dictation-notice">This demo may retain dictated text for diagnostics.</p>')
})

it("offers resetting to the sample tasks as a button beside the assignee filter", () => {
    const controls = markup.match(/<div class="task-list-controls">[\s\S]*?<div class="task /)?.[0]

    expect(controls).toContain('<label class="assignee-filter">')
    expect(controls).toMatch(/<button type="button" class="reset-tasks-button">Reset to sample tasks<\/button>/)
})

it("says how to dictate, with the button's microphone in place of the word", () => {
    const hint = markup.match(/<p class="dictation-hint">([\s\S]*?)<\/p>/)?.[1]
    const buttonIcon = taskMarkup[0].match(/<path[^>]*>/)?.[0]

    expect(hint?.replace(/<svg[^>]*role="img" aria-label="microphone"[^>]*>[\s\S]*?<\/svg>/, "[microphone]")).toBe(
        "Dictate a task title: click its [microphone] button, or click a title and press Ctrl + Alt. These both toggle the mic on/off.",
    )
    expect(buttonIcon).toBeDefined()
    expect(hint).toContain(buttonIcon)
    expect(hint).not.toContain("<button")
})

it("starts with an empty dictation status and the horizontal bar selected", () => {
    expect(markup).toContain('<p class="dictation-status" role="status"></p>')
    expect(markup).not.toContain("level-meter")
    expect(markup).toContain('<button type="button" aria-pressed="true">Horizontal bar</button>')
    expect(markup).toContain('<button type="button" aria-pressed="false">Analogue needle</button>')
})
