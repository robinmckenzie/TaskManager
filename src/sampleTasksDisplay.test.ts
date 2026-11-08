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

it("shows the overdue sample task first and the completed one last, which is not styled as overdue", () => {
    const first = taskMarkup[0]
    const last = taskMarkup[6]

    expect(taskMarkup).toHaveLength(7)
    expect(first).toContain('>Fix authentication bug</textarea>')
    expect(first.startsWith("task-overdue")).toBe(true)
    expect(first).toContain("2 days overdue")
    expect(first).toContain('<span class="task-assignee-name">Bob</span>')
    expect(first).toContain('<span class="task-priority-number">5</span>')

    expect(last).toContain('>Deploy initial build</textarea>')
    expect(last.startsWith("task-completed")).toBe(true)
    expect(last).toContain("Completed")
    expect(last).not.toContain("overdue")
    expect(last).toContain('<span class="task-assignee-name">Bob</span>')
})

it("gives no task an inline animation, so that an overdue task does not pulse", () => {
    expect(markup).not.toContain("animation")
})

it("tells visitors that dictated text may be retained", () => {
    expect(markup).toContain('<p class="dictation-notice">This demo may retain dictated text for diagnostics.</p>')
})

const resetButton = '<button type="button" class="reset-tasks-button">Reset to sample tasks</button>'

it("offers resetting to the sample tasks as a button below the last task, with the assignee filter above the tasks", () => {
    const beforeTasks = markup.slice(0, markup.indexOf('<div class="task '))

    expect(beforeTasks).toContain('<nav class="assignee-filter"')
    expect(beforeTasks).not.toContain("Reset to sample tasks")
    expect(markup.split(resetButton)).toHaveLength(2)
    expect(taskMarkup[6]).toContain(`${resetButton}</section></main>`)
})

// One task, for Alice, so that the other three assignees have none.
const aliceOnly = JSON.stringify([
    { id: "saved-1", text: "Only task", userId: "1", priority: 3, dueDate: "", completed: false },
])

it.each([
    ["the list is empty", { [TASKS_STORAGE_KEY]: "[]" }, "0 tasks"],
    [
        "the assignee filter matches no task",
        { [TASKS_STORAGE_KEY]: aliceOnly, [ASSIGNEE_FILTER_STORAGE_KEY]: "4" },
        "0 of 1 task",
    ],
])("still offers resetting to the sample tasks, below the controls, when %s", (_view, saved, taskCount) => {
    vi.stubGlobal("localStorage", {
        getItem: (key: string): string | null => (saved as Record<string, string>)[key] ?? null,
    })
    const emptyMarkup = renderToStaticMarkup(createElement(App))

    expect(emptyMarkup).not.toContain('<div class="task ')
    expect(emptyMarkup).toContain(taskCount)
    expect(emptyMarkup.split(resetButton)).toHaveLength(2)
    expect(emptyMarkup).toContain(`${resetButton}</section></main>`)
})

it("names each control on a task card after what it does and its task", () => {
    const [first, second] = taskMarkup

    for (const name of [
        "Task title",
        "Start dictation into Fix authentication bug",
        "Due date for Fix authentication bug",
        "Priority for Fix authentication bug",
        "Assignee for Fix authentication bug",
        "Complete Fix authentication bug",
        "Delete Fix authentication bug",
    ]) {
        expect(first).toContain(`aria-label="${name}"`)
    }

    expect(first).toContain('aria-valuetext="5 of 5"')
    expect(second).toContain('aria-label="Delete Prepare sprint demo"')
})

it("says how to dictate, with the button's microphone in place of the word", () => {
    const hint = markup.match(/<p class="dictation-hint">([\s\S]*?)<\/p>/)?.[1]
    const buttonIcon = taskMarkup[0].match(/<button[^>]*dictation-button[^>]*>.*?(<path[^>]*>)/)?.[1]

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
