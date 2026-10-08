import { describe, expect, it } from "vitest"
import { getScrollLeftForCaret } from "./caretScroll"

describe("getScrollLeftForCaret", () => {
    it("leaves the scroll offset alone when the caret is already visible", () => {
        expect(getScrollLeftForCaret(150, 100, 200, 10)).toBe(100)
    })

    it("scrolls right just far enough to show a caret beyond the right edge", () => {
        expect(getScrollLeftForCaret(400, 0, 200, 10)).toBe(210)
    })

    it("scrolls left to show a caret before the left edge", () => {
        expect(getScrollLeftForCaret(50, 100, 200, 10)).toBe(40)
    })

    it("never scrolls before the start of the text", () => {
        expect(getScrollLeftForCaret(4, 100, 200, 10)).toBe(0)
    })
})
