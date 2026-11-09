import { describe, expect, it } from "vitest"
import { getPageScrollForCaretLine, getScrollLeftForCaret } from "./caretScroll"

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

describe("getPageScrollForCaretLine", () => {
    it("does not scroll when the caret line is inside the window", () => {
        expect(getPageScrollForCaretLine(100, 122, 600, 10)).toBe(0)
    })

    it("scrolls down just far enough to show a line below the window", () => {
        expect(getPageScrollForCaretLine(590, 612, 600, 10)).toBe(22)
    })

    it("scrolls up to show a line above the window", () => {
        expect(getPageScrollForCaretLine(-40, -18, 600, 10)).toBe(-50)
    })
})
