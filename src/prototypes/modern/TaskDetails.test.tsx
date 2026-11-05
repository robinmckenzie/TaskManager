import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import type { TaskType } from "../../tasks"
import { getTaskControlNames } from "../../taskControlNames"
import { TaskDetails } from "./ModernApp"

/*
 * The details panel rendered to markup, to check that the date input and the
 * quick due-date buttons both reflect the task's due date.
 */

const today = new Date(2026, 11, 31)

const task: TaskType = {
    id: "t1",
    text: "Send the invoice",
    userId: "u1",
    priority: 3,
    dueDate: "",
    completed: false,
}

/** Renders the panel to HTML. The tests run without a DOM, so they read the markup directly. */
const renderPanel = (dueDate: string): string =>
    renderToStaticMarkup(
        <TaskDetails
            task={{ ...task, dueDate }}
            today={today}
            panelId="panel"
            names={getTaskControlNames(task.text, 1)}
            focusField={null}
            updateTask={(): void => {}}
            deleteTask={(): void => {}}
            onClose={(): void => {}}
        />,
    )

const dateInputValue = (html: string): string | undefined =>
    /<input type="date"[^>]*value="([^"]*)"/.exec(html)?.[1]

const pressedButtons = (html: string): string[] =>
    [...html.matchAll(/<button type="button" class="md-quick-date" aria-pressed="true"[^>]*>([^<]*)<\/button>/g)].map(
        (match) => match[1],
    )

const quickButtons = (html: string): string[] =>
    [...html.matchAll(/<button type="button" class="md-quick-date"[^>]*aria-label="([^"]*)"/g)].map((match) => match[1])

describe("TaskDetails quick due dates", () => {
    it("offers the three buttons, named with their dates, across a year end", () => {
        expect(quickButtons(renderPanel(""))).toEqual([
            "Today, Thu 31 Dec",
            "Tomorrow, Fri 1 Jan 2027",
            "In a week, Thu 7 Jan 2027",
        ])
    })

    it.each([
        ["2026-12-31", "Today"],
        ["2027-01-01", "Tomorrow"],
        ["2027-01-07", "In a week"],
    ])("shows %s in the date input and marks %s as chosen", (dueDate, label) => {
        const html = renderPanel(dueDate)

        expect(dateInputValue(html)).toBe(dueDate)
        expect(pressedButtons(html)).toEqual([label])
    })

    it("marks no button for another date chosen in the date input", () => {
        const html = renderPanel("2027-01-02")

        expect(dateInputValue(html)).toBe("2027-01-02")
        expect(pressedButtons(html)).toEqual([])
    })

    it("marks no button and leaves the date input empty without a due date", () => {
        const html = renderPanel("")

        expect(dateInputValue(html)).toBe("")
        expect(pressedButtons(html)).toEqual([])
    })
})
