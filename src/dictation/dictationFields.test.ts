import { describe, expect, it, vi } from "vitest"
import { scrollCaretIntoView } from "./caretScroll"
import { findFieldId, findShortcutTargetId, focusFieldWithSavedSelection, isTextArea } from "./dictationFields"
import type { DictationField } from "./dictationFields"

type FieldKind = "input" | "textarea"

/** A stand-in for the part of a field that dictation uses. */
const createField = (kind: FieldKind, value = "", selection = { start: value.length, end: value.length }) => {
    const field = {
        localName: kind === "input" ? "input" : "textarea",
        value,
        selectionStart: selection.start,
        selectionEnd: selection.end,
        scrollLeft: 0,
        focus: vi.fn(),
        setSelectionRange: vi.fn((start: number, end: number) => {
            field.selectionStart = start
            field.selectionEnd = end
        }),
    }

    return field
}

const asField = (field: ReturnType<typeof createField>): DictationField => field as unknown as DictationField

describe.each<FieldKind>(["input", "textarea"])("dictation field helpers for a %s", (kind) => {
    it("finds a field's id from the focused element, for the shortcut", () => {
        const first = createField(kind, "one")
        const second = createField(kind, "two")
        const fields = new Map([["a", asField(first)], ["b", asField(second)]])

        expect(findFieldId(fields, second)).toBe("b")
        expect(findFieldId(fields, null)).toBeUndefined()
        expect(findFieldId(fields, createField(kind))).toBeUndefined()
    })

    it("finds the id of a microphone button from its map in the same way", () => {
        const button = {}
        const buttons = new Map([["a", button], ["b", {}]])

        expect(findFieldId(buttons, button)).toBe("a")
    })

    it("targets the focused field, or the focused microphone button, for the shortcut", () => {
        const first = createField(kind, "one")
        const second = createField(kind, "two")
        const fields = new Map([["a", asField(first)], ["b", asField(second)]])
        const micA = {}
        const micB = {}
        const buttons = new Map([["a", micA], ["b", micB]])

        expect(findShortcutTargetId(fields, buttons, first)).toBe("a")
        expect(findShortcutTargetId(fields, buttons, micB)).toBe("b")
        expect(findShortcutTargetId(fields, buttons, {})).toBeUndefined()
        expect(findShortcutTargetId(fields, buttons, null)).toBeUndefined()
    })

    it("restores a saved selection when focusing", () => {
        const field = createField(kind, "Fix the bug")

        focusFieldWithSavedSelection(field, { start: 4, end: 7 }, false)

        expect(field.focus).toHaveBeenCalledOnce()
        expect(field.setSelectionRange).toHaveBeenCalledWith(4, 7)
    })

    it("puts the cursor at the end when nothing was saved", () => {
        const field = createField(kind, "Fix the bug", { start: 0, end: 0 })

        focusFieldWithSavedSelection(field, undefined, false)

        expect(field.setSelectionRange).toHaveBeenCalledWith(11, 11)
    })

    it("limits a saved selection to the text the field has now", () => {
        const field = createField(kind, "Fix")

        focusFieldWithSavedSelection(field, { start: 4, end: 20 }, false)

        expect(field.setSelectionRange).toHaveBeenCalledWith(3, 3)
    })

    it("leaves a field that already has focus alone", () => {
        const field = createField(kind, "Fix the bug", { start: 2, end: 5 })

        focusFieldWithSavedSelection(field, { start: 4, end: 7 }, true)

        expect(field.focus).not.toHaveBeenCalled()
        expect(field.setSelectionRange).not.toHaveBeenCalled()
    })
})

describe("isTextArea", () => {
    it("tells a text area from a single-line input", () => {
        expect(isTextArea(asField(createField("textarea")))).toBe(true)
        expect(isTextArea(asField(createField("input")))).toBe(false)
    })
})

describe("scrollCaretIntoView for a text area", () => {
    it("does not scroll or measure anything, because the text area grows to fit its text", () => {
        const textArea = createField("textarea", "A long title that wraps onto more than one line")

        // getComputedStyle and document are unavailable here: touching either would throw.
        expect(() => scrollCaretIntoView(asField(textArea))).not.toThrow()
        expect(textArea.scrollLeft).toBe(0)
    })
})
