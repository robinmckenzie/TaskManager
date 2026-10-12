import { describe, expect, it } from "vitest"
import { createLevelHistory } from "./levelHistory"

describe("createLevelHistory", () => {
    it("starts with every level at zero", () => {
        expect(createLevelHistory(4, 100).read()).toEqual([0, 0, 0, 0])
    })

    it("keeps the highest level recorded during a step as the newest", () => {
        const history = createLevelHistory(4, 100)

        history.record(0.2, 0)
        history.record(0.7, 40)
        history.record(0.3, 80)

        expect(history.read()).toEqual([0, 0, 0, 0.7])
    })

    it("moves on by one level for each step that has passed, oldest first", () => {
        const history = createLevelHistory(4, 100)

        history.record(0.2, 0)
        history.record(0.5, 100)
        history.record(0.9, 350)

        expect(history.read()).toEqual([0.2, 0.5, 0.9, 0.9])
    })

    it("steps at a steady rate, however unevenly the levels arrive", () => {
        const history = createLevelHistory(4, 100)

        history.record(0.1, 0)
        history.record(0.2, 150)
        history.record(0.3, 210)

        expect(history.read()).toEqual([0, 0.1, 0.2, 0.3])
    })

    it("holds no more than its length after a long gap", () => {
        const history = createLevelHistory(4, 100)

        history.record(0.6, 0)
        history.record(0.4, 60_000)

        expect(history.read()).toEqual([0.4, 0.4, 0.4, 0.4])
    })
})
