import { describe, expect, it } from "vitest"
import {
    initialCtrlAltShortcutState,
    trackShortcutKeyDown,
    trackShortcutKeyUp,
} from "./ctrlAltShortcut"

type KeyStep = [direction: "down" | "up", key: string, isAltGraph?: boolean]

/** Plays a sequence of key presses and counts how often the shortcut fires. */
const countToggles = (steps: readonly KeyStep[]): number => {
    let state = initialCtrlAltShortcutState
    let toggles = 0

    for (const [direction, key, isAltGraph = false] of steps) {
        if (direction === "down") {
            state = trackShortcutKeyDown(state, { key, code: key, isAltGraph })
        } else {
            const result = trackShortcutKeyUp(state, { key, code: key, isAltGraph })
            state = result.state
            toggles += result.shouldToggle ? 1 : 0
        }
    }

    return toggles
}

describe("Ctrl + Alt shortcut", () => {
    it("fires once when Ctrl and Alt are pressed together and released", () => {
        expect(countToggles([
            ["down", "Control"], ["down", "Alt"], ["up", "Alt"], ["up", "Control"],
        ])).toBe(1)
        expect(countToggles([
            ["down", "Alt"], ["down", "Control"], ["up", "Control"], ["up", "Alt"],
        ])).toBe(1)
    })

    it("does not fire for a chord with a third key such as Ctrl + Alt + T", () => {
        expect(countToggles([
            ["down", "Control"], ["down", "Alt"], ["down", "t"], ["up", "t"],
            ["up", "Alt"], ["up", "Control"],
        ])).toBe(0)
    })

    it("does not fire for Ctrl or Alt pressed alone", () => {
        expect(countToggles([["down", "Control"], ["up", "Control"]])).toBe(0)
        expect(countToggles([["down", "Alt"], ["up", "Alt"]])).toBe(0)
    })

    it("does not fire for AltGr typing", () => {
        expect(countToggles([
            ["down", "Control", true], ["down", "AltGraph", true], ["down", "€", true],
            ["up", "€", true], ["up", "AltGraph", true], ["up", "Control", true],
        ])).toBe(0)
    })

    it("ignores ordinary typing and fires again for a later press", () => {
        expect(countToggles([
            ["down", "a"], ["up", "a"],
            ["down", "Control"], ["down", "Alt"], ["up", "Alt"], ["up", "Control"],
            ["down", "Control"], ["down", "Alt"], ["up", "Control"], ["up", "Alt"],
        ])).toBe(2)
    })

    it("does not fire again while one modifier is still held", () => {
        expect(countToggles([
            ["down", "Control"], ["down", "Alt"], ["up", "Alt"], ["down", "Alt"],
            ["up", "Alt"], ["up", "Control"],
        ])).toBe(1)
    })

    it("does not fire when a third key is already held, such as Shift + Ctrl + Alt", () => {
        expect(countToggles([
            ["down", "Shift"], ["down", "Control"], ["down", "Alt"],
            ["up", "Alt"], ["up", "Control"], ["up", "Shift"],
        ])).toBe(0)
    })

    it("keeps not firing while the third key stays held", () => {
        expect(countToggles([
            ["down", "t"],
            ["down", "Control"], ["down", "Alt"], ["up", "Alt"], ["up", "Control"],
            ["down", "Control"], ["down", "Alt"], ["up", "Alt"], ["up", "Control"],
        ])).toBe(0)
    })

    it("fires again once the third key has been released", () => {
        expect(countToggles([
            ["down", "Shift"], ["down", "Control"], ["up", "Control"], ["up", "Shift"],
            ["down", "Control"], ["down", "Alt"], ["up", "Alt"], ["up", "Control"],
        ])).toBe(1)
    })

    it("does not leave AltGr counted as held after it is released", () => {
        expect(countToggles([
            ["down", "Control", true], ["down", "AltGraph", true], ["up", "Control"], ["up", "AltGraph"],
            ["down", "Control"], ["down", "Alt"], ["up", "Alt"], ["up", "Control"],
        ])).toBe(1)
    })
})
