import { describe, expect, it } from "vitest"
import { toSingleLine } from "./singleLineText"

describe("toSingleLine", () => {
    it("leaves text without line breaks unchanged", () => {
        expect(toSingleLine("Buy milk  today")).toBe("Buy milk  today")
    })

    it("turns each kind of line break into one space", () => {
        expect(toSingleLine("a\nb")).toBe("a b")
        expect(toSingleLine("a\rb")).toBe("a b")
        expect(toSingleLine("a\r\nb")).toBe("a b")
        expect(toSingleLine("a b c")).toBe("a b c")
    })

    it("keeps consecutive breaks as consecutive spaces", () => {
        expect(toSingleLine("a\n\nb")).toBe("a  b")
    })

    it("leaves a blank title blank", () => {
        expect(toSingleLine("")).toBe("")
    })
})
