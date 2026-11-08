import { describe, expect, it } from "vitest"
import { keepPanelIfShown, togglePanel } from "./detailsPanel"

describe("togglePanel", () => {
    it("opens a panel when none is open, remembering the field to focus", () => {
        expect(togglePanel(null, "a", "priority")).toEqual({ taskId: "a", focusField: "priority" })
    })

    it("closes the panel when its own summary is clicked again", () => {
        expect(togglePanel({ taskId: "a", focusField: "due" }, "a", "due")).toBeNull()
        expect(togglePanel({ taskId: "a", focusField: null }, "a", null)).toBeNull()
    })

    it("closes the open panel when another task's summary opens its own", () => {
        expect(togglePanel({ taskId: "a", focusField: "due" }, "b", null)).toEqual({
            taskId: "b",
            focusField: null,
        })
    })
})

describe("keepPanelIfShown", () => {
    it("keeps a panel whose task is on show", () => {
        const open = { taskId: "a", focusField: null }

        expect(keepPanelIfShown(open, ["b", "a"])).toBe(open)
    })

    it("closes a panel whose task is hidden or gone", () => {
        expect(keepPanelIfShown({ taskId: "a", focusField: null }, ["b"])).toBeNull()
        expect(keepPanelIfShown({ taskId: "a", focusField: null }, [])).toBeNull()
    })

    it("leaves no panel closed", () => {
        expect(keepPanelIfShown(null, ["a"])).toBeNull()
    })
})
