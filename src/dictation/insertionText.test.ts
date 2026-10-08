import { describe, expect, it } from "vitest"
import {
    applyEdit,
    composeTokens,
    findEdit,
    moveAreaForEdit,
    prepareInsertion,
    shiftPosition,
    shiftRangeForChange,
} from "./insertionText"
import type { TextRange, TranscriptToken } from "./insertionText"

/** Prepares `text` at `range`, then writes `spoken` into the prepared area. */
const dictate = (text: string, range: TextRange, spoken: string) => {
    const { edit, position } = prepareInsertion(text, range)
    const prepared = applyEdit(text, edit)
    const result = applyEdit(prepared, { start: position, end: position, insert: spoken })

    return { prepared, result, cursor: position + spoken.length }
}

const showCursor = (text: string, cursor: number): string =>
    `${text.slice(0, cursor)}|${text.slice(cursor)}`

describe("prepareInsertion", () => {
    it("separates dictation inserted between words on both sides", () => {
        const { prepared, result, cursor } = dictate("Fixbug", { start: 3, end: 3 }, "urgent")

        expect(prepared).toBe("Fix  bug")
        expect(showCursor(result, cursor)).toBe("Fix urgent| bug")
    })

    it("lets later recognition extend the phrase inside the prepared area", () => {
        const { edit, position } = prepareInsertion("Fixbug", { start: 3, end: 3 })
        const prepared = applyEdit("Fixbug", edit)
        const first = applyEdit(prepared, { start: position, end: position, insert: "urgent" })
        const extended = applyEdit(first, {
            start: position,
            end: position + "urgent".length,
            insert: "urgent problem",
        })

        expect(showCursor(extended, position + "urgent problem".length))
            .toBe("Fix urgent problem| bug")
    })

    it("adds a leading space only when text before is not a space", () => {
        const afterWord = dictate("Fix", { start: 3, end: 3 }, "bug")
        const afterSpace = dictate("Fix ", { start: 4, end: 4 }, "bug")

        expect(showCursor(afterWord.result, afterWord.cursor)).toBe("Fix bug|")
        expect(showCursor(afterSpace.result, afterSpace.cursor)).toBe("Fix bug|")
    })

    it("replaces a selection without doubling surrounding spaces", () => {
        const { result, cursor } = dictate("Fix old bug", { start: 4, end: 7 }, "new")

        expect(showCursor(result, cursor)).toBe("Fix new| bug")
    })

    it("treats a backwards selection like a forwards one", () => {
        expect(dictate("Fix old bug", { start: 7, end: 4 }, "new").result).toBe("Fix new bug")
    })

    it("adds no spaces in an empty input or at its edges", () => {
        expect(prepareInsertion("", { start: 0, end: 0 }).edit.insert).toBe("")
        expect(dictate("bug", { start: 0, end: 0 }, "Fix").result).toBe("Fix bug")
    })
})

describe("composeTokens", () => {
    const token = (content: string, attachesTo?: TranscriptToken["attachesTo"]): TranscriptToken =>
        ({ content, startTime: 0, attachesTo })

    it("separates words with single spaces", () => {
        expect(composeTokens([token("urgent"), token("problem")])).toBe("urgent problem")
    })

    it("attaches punctuation according to the recognition result", () => {
        expect(composeTokens([token("Fix"), token("it", "none"), token(".", "previous")]))
            .toBe("Fix it.")
        expect(composeTokens([token("("), token("soon")].map((t, i) =>
            i === 0 ? { ...t, attachesTo: "next" as const } : t))).toBe("(soon")
    })

    it("returns empty text when nothing is recognised", () => {
        expect(composeTokens([])).toBe("")
    })
})

describe("findEdit", () => {
    it("finds an insertion, deletion and replacement", () => {
        expect(findEdit("Fix bug", "Fix a bug")).toEqual({ start: 4, end: 4, insert: "a " })
        expect(findEdit("Fix a bug", "Fix bug")).toEqual({ start: 4, end: 6, insert: "" })
        expect(findEdit("Fix old bug", "Fix new bug")).toEqual({ start: 4, end: 7, insert: "new" })
    })

    it("finds no change for identical text", () => {
        expect(findEdit("same", "same")).toEqual({ start: 4, end: 4, insert: "" })
    })
})

describe("shiftPosition", () => {
    const edit = { start: 4, end: 7, insert: "newer" }

    it("leaves earlier positions and moves later positions", () => {
        expect(shiftPosition(2, edit)).toBe(2)
        expect(shiftPosition(9, edit)).toBe(11)
    })

    it("moves positions inside a replaced range to the end of the insertion", () => {
        expect(shiftPosition(5, edit)).toBe(9)
    })
})

describe("shiftRangeForChange", () => {
    it("keeps a selection on the same text when earlier text grows", () => {
        const before = "Fix urgent bug"
        const after = "Fix urgent problem bug"
        const selection = shiftRangeForChange({ start: 11, end: 14 }, before, after)

        expect(before.slice(11, 14)).toBe("bug")
        expect(after.slice(selection.start, selection.end)).toBe("bug")
    })

    it("keeps a selection on the same text when earlier text shrinks", () => {
        const selection = shiftRangeForChange({ start: 15, end: 18 }, "Fix the urgent bug", "Fix urgent bug")

        expect(selection).toEqual({ start: 11, end: 14 })
    })

    it("leaves a selection alone when later text or nothing changes", () => {
        expect(shiftRangeForChange({ start: 0, end: 3 }, "Fix bug", "Fix bug today")).toEqual({ start: 0, end: 3 })
        expect(shiftRangeForChange({ start: 4, end: 7 }, "Fix bug", "Fix bug")).toEqual({ start: 4, end: 7 })
    })
})

describe("moveAreaForEdit", () => {
    const area = { start: 4, end: 10 }

    it("keeps an area when text is typed immediately after it", () => {
        expect(moveAreaForEdit(area, { start: 10, end: 10, insert: "!" })).toEqual(area)
    })

    it("shifts an area when text before it changes", () => {
        expect(moveAreaForEdit(area, { start: 0, end: 0, insert: "An " })).toEqual({ start: 7, end: 13 })
        expect(moveAreaForEdit(area, { start: 4, end: 4, insert: "x" })).toEqual({ start: 5, end: 11 })
    })

    it("detaches an area when its own text is edited", () => {
        expect(moveAreaForEdit(area, { start: 6, end: 7, insert: "" })).toBeUndefined()
        expect(moveAreaForEdit(area, { start: 2, end: 5, insert: "" })).toBeUndefined()
    })

    it("shifts an empty area for a deletion just before it", () => {
        expect(moveAreaForEdit({ start: 3, end: 3 }, { start: 2, end: 3, insert: "" }))
            .toEqual({ start: 2, end: 2 })
    })
})
