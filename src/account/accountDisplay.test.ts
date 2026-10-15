import { describe, expect, it } from "vitest"
import { buildReturnAddress, chooseDisplayName, hasSignInError } from "./accountDisplay"

describe("chooseDisplayName", () => {
    it("shows the preferred name once set", () => {
        expect(chooseDisplayName("Ada Lovelace", "Ada")).toBe("Ada")
    })

    it("shows the Google name when no preferred name is set", () => {
        expect(chooseDisplayName("Ada Lovelace", null)).toBe("Ada Lovelace")
    })

    it("falls back to a description when Google gave no name", () => {
        expect(chooseDisplayName("  ", null)).toBe("your Google account")
    })
})

describe("buildReturnAddress", () => {
    it("keeps the path and the testing label", () => {
        expect(buildReturnAddress({ pathname: "/", search: "?user=Robin" })).toBe("/?user=Robin")
    })

    it("returns just the path when there is no query", () => {
        expect(buildReturnAddress({ pathname: "/", search: "" })).toBe("/")
    })

    it("drops the error left by an earlier failed sign-in", () => {
        expect(
            buildReturnAddress({ pathname: "/", search: "?user=Robin&error=access_denied&error_description=x" }),
        ).toBe("/?user=Robin")
        expect(buildReturnAddress({ pathname: "/", search: "?error=state_mismatch" })).toBe("/")
    })
})

describe("hasSignInError", () => {
    it("recognises the error parameter Better Auth adds", () => {
        expect(hasSignInError("?error=access_denied")).toBe(true)
        expect(hasSignInError("?user=Robin")).toBe(false)
    })
})
