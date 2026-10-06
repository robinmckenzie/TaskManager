import { describe, expect, it, vi } from "vitest"
import { DictationController } from "./dictationController"
import type { DictationState, DictationTextTarget } from "./dictationController"
import type { DictationSessionListener } from "./dictationSession"
import type { TextRange, TranscriptToken } from "./insertionText"

interface FakeTarget extends DictationTextTarget {
    value: string
    selection: TextRange
    isFocusedNow: boolean
}

const createTarget = (value: string, cursor = value.length): FakeTarget => {
    const target: FakeTarget = {
        value,
        selection: { start: cursor, end: cursor },
        isFocusedNow: true,
        getValue: () => target.value,
        getSelection: () => target.selection,
        isFocused: () => target.isFocusedNow,
        writeValue: (next, selection) => {
            target.value = next

            if (selection) {
                target.selection = selection
            }
        },
    }

    return target
}

const showCursor = (target: FakeTarget): string =>
    `${target.value.slice(0, target.selection.end)}|${target.value.slice(target.selection.end)}`

/** Creates a controller whose sessions are driven directly by the test. */
const setUp = (targets: Record<string, FakeTarget>) => {
    const sessions: {
        listener: DictationSessionListener
        audioTime: number
        stop: ReturnType<typeof vi.fn>
    }[] = []
    const states: DictationState[] = []
    const controller = new DictationController({
        createSession: (listener) => {
            const session = {
                listener,
                audioTime: 0,
                start: async () => undefined,
                stop: vi.fn((reason) => listener.onStopped(reason)),
            }
            sessions.push(session)
            return session
        },
        getTarget: (id) => targets[id],
        onStateChange: (state) => states.push(state),
    })

    const words = (startTime: number, ...contents: string[]): TranscriptToken[] =>
        contents.map((content, index) => ({ content, startTime: startTime + index * 0.1 }))
    const latest = () => sessions[sessions.length - 1]
    const partial = (startTime: number, ...contents: string[]) =>
        latest().listener.onTranscript(false, words(startTime, ...contents))
    const final = (startTime: number, ...contents: string[]) =>
        latest().listener.onTranscript(true, words(startTime, ...contents))

    return { controller, sessions, states, latest, partial, final }
}

describe("DictationController", () => {
    it("prepares the area once and updates it as recognition arrives", () => {
        const title = createTarget("Fixbug", 3)
        const { controller, partial, final } = setUp({ a: title })

        controller.start("a", title.selection)
        partial(0, "urgent")
        expect(showCursor(title)).toBe("Fix urgent| bug")

        partial(0, "urgent", "problem")
        expect(showCursor(title)).toBe("Fix urgent problem| bug")

        final(0, "urgent", "problem")
        expect(title.value).toBe("Fix urgent problem bug")
    })

    it("changes nothing until speech is recognised", () => {
        const title = createTarget("Fixbug", 3)
        const { controller, partial } = setUp({ a: title })

        controller.start("a", title.selection)
        partial(0)

        expect(title.value).toBe("Fixbug")
    })

    it("replaces a selection with dictated speech", () => {
        const title = createTarget("Fix old bug")
        title.selection = { start: 4, end: 7 }
        const { controller, final } = setUp({ a: title })

        controller.start("a", title.selection)
        final(0, "new")

        expect(showCursor(title)).toBe("Fix new| bug")
    })

    it("keeps revising provisional text where it began after the cursor moves", () => {
        const title = createTarget("Fix bug", 3)
        const { controller, latest, partial, final } = setUp({ a: title })

        controller.start("a", title.selection)
        partial(0, "the")
        expect(title.value).toBe("Fix the bug")

        latest().audioTime = 1
        title.selection = { start: title.value.length, end: title.value.length }
        controller.moveInsertionPoint("a", title.selection)

        partial(0, "that")
        expect(title.value).toBe("Fix that bug")

        final(0, "that")
        partial(1, "today")
        expect(showCursor(title)).toBe("Fix that bug today|")
    })

    it("follows focus to another title within the same session", () => {
        const first = createTarget("First")
        const second = createTarget("Second")
        const { controller, sessions, latest, final } = setUp({ a: first, b: second })

        controller.start("a", first.selection)
        final(0, "one")
        latest().audioTime = 2
        first.isFocusedNow = false
        controller.moveInsertionPoint("b", second.selection)
        final(2, "two")

        expect(first.value).toBe("First one")
        expect(second.value).toBe("Second two")
        expect(sessions).toHaveLength(1)
        expect(controller.activeTargetId).toBe("b")
    })

    it("stops revising text that the user has edited", () => {
        const title = createTarget("Fix")
        const { controller, partial } = setUp({ a: title })

        controller.start("a", title.selection)
        partial(0, "the", "bug")
        expect(title.value).toBe("Fix the bug")

        controller.recordUserEdit("a", "Fix the bug", "Fix a bug")
        title.value = "Fix a bug"
        partial(0, "the", "bugs")

        expect(title.value).toBe("Fix a bug")
    })

    it("keeps areas aligned when the user types before them", () => {
        const title = createTarget("Fix")
        const { controller, partial } = setUp({ a: title })

        controller.start("a", title.selection)
        partial(0, "the")
        controller.recordUserEdit("a", "Fix the", "Now Fix the")
        title.value = "Now Fix the"
        partial(0, "the", "bug")

        expect(title.value).toBe("Now Fix the bug")
    })

    it("starts a fresh session when another title's dictation is started", () => {
        const first = createTarget("First")
        const second = createTarget("Second")
        const { controller, sessions } = setUp({ a: first, b: second })

        controller.start("a", first.selection)
        controller.start("b", second.selection)

        expect(sessions).toHaveLength(2)
        expect(sessions[0].stop).toHaveBeenCalledWith("user")
        expect(controller.activeTargetId).toBe("b")
    })

    it("lets the previous session's text settle after switching", () => {
        const first = createTarget("First")
        const second = createTarget("Second")
        const { controller, sessions } = setUp({ a: first, b: second })

        controller.start("a", first.selection)
        controller.start("b", second.selection)
        sessions[0].listener.onTranscript(true, [{ content: "late", startTime: 0 }])

        expect(first.value).toBe("First late")
        expect(second.value).toBe("Second")
    })

    it("stops when the dictated task is removed but not for other tasks", () => {
        const first = createTarget("First")
        const second = createTarget("Second")
        const { controller, latest } = setUp({ a: first, b: second })

        controller.start("a", first.selection)
        controller.removeTarget("b")
        expect(latest().stop).not.toHaveBeenCalled()

        controller.removeTarget("a")
        expect(latest().stop).toHaveBeenCalledWith("task_deleted")
    })

    it("reports state changes with plain-language messages", () => {
        const title = createTarget("Fix")
        const { controller, latest, states } = setUp({ a: title })

        controller.start("a", title.selection)
        latest().listener.onListening()
        latest().listener.onStopped("inactivity")

        expect(states.map(({ phase, message }) => [phase, message])).toEqual([
            ["starting", "Starting dictation."],
            ["listening", "Dictation started."],
            ["idle", "Dictation stopped after 10 seconds without recognised speech."],
        ])
        expect(controller.isActive).toBe(false)
    })

    it("reports errors with their message", () => {
        const title = createTarget("Fix")
        const { controller, latest, states } = setUp({ a: title })

        controller.start("a", title.selection)
        latest().listener.onStopped("error", "microphone_denied")

        expect(states.at(-1)?.message).toMatch(/microphone access/)
    })
})
