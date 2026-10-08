import { describe, expect, it, vi } from "vitest"
import { DictationController } from "./dictationController"
import type { DictationSessionListener } from "./dictationSession"
import { createDictationTargets } from "./dictationTargets"
import type { TargetInput } from "./dictationTargets"
import type { TextRange, TranscriptToken } from "./insertionText"

/**
 * A small stand-in for the app: tasks with text, some of them shown as inputs
 * on the page. Showing and hiding an input is what filtering tasks does.
 */
const createApp = (initial: Record<string, string>) => {
    const texts = new Map(Object.entries(initial))
    const inputs = new Map<string, TargetInput & { setSelectionRange: ReturnType<typeof vi.fn> }>()
    const savedSelections = new Map<string, TextRange>()
    let focusedId: string | undefined

    const show = (id: string): void => {
        const text = texts.get(id) ?? ""
        const input = {
            value: text,
            selectionStart: text.length,
            selectionEnd: text.length,
            setSelectionRange: vi.fn((start: number, end: number) => {
                input.selectionStart = start
                input.selectionEnd = end
            }),
        }
        inputs.set(id, input)
    }

    const targets = createDictationTargets({
        getInput: (id) => inputs.get(id),
        getText: (id) => texts.get(id),
        setText: (id, text) => {
            texts.set(id, text)

            // As React does, the input on the page shows the new text at once.
            const input = inputs.get(id)

            if (input) {
                input.value = text
            }
        },
        isFocused: (input) => focusedId !== undefined && inputs.get(focusedId) === input,
        revealCaret: () => undefined,
        savedSelections,
    })

    Object.keys(initial).forEach(show)

    return {
        texts,
        inputs,
        savedSelections,
        targets,
        show,
        focus: (id: string) => {
            focusedId = id
        },
        /** Takes a task's input off the page, as filtering the task out does. */
        hide: (id: string) => {
            const input = inputs.get(id)

            if (input) {
                savedSelections.set(id, { start: input.selectionStart ?? 0, end: input.selectionEnd ?? 0 })
            }

            inputs.delete(id)
            focusedId = focusedId === id ? undefined : focusedId
        },
        remove: (id: string) => {
            inputs.delete(id)
            texts.delete(id)
        },
    }
}

/** A controller writing into the app, with a session driven by the test. */
const setUp = (initial: Record<string, string>) => {
    const app = createApp(initial)
    let listener!: DictationSessionListener
    const controller = new DictationController({
        createSession: (sessionListener) => {
            listener = sessionListener

            return {
                audioTime: 0,
                start: async () => undefined,
                stop: (reason) => sessionListener.onStopped(reason),
            }
        },
        getTarget: app.targets.get,
        onStateChange: () => undefined,
    })
    const words = (...contents: string[]): TranscriptToken[] =>
        contents.map((content, index) => ({ content, startTime: index * 0.1 }))

    return {
        app,
        controller,
        partial: (...contents: string[]) => listener.onTranscript(false, words(...contents)),
        final: (...contents: string[]) => listener.onTranscript(true, words(...contents)),
    }
}

describe("dictation targets", () => {
    it("applies a final correction to a task filtered out after its partial result", () => {
        const { app, controller, partial, final } = setUp({ a: "Fix ", b: "Other" })

        app.focus("a")
        controller.start("a", { start: 4, end: 4 })
        partial("the", "bug")
        expect(app.texts.get("a")).toBe("Fix the bug")

        // The task is filtered out: its input leaves the page, focus is lost
        // and dictation stops, while its recognised text is still settling.
        app.hide("a")
        controller.stop("focus")
        final("the", "Bug.")

        expect(app.texts.get("a")).toBe("Fix the Bug.")
        expect(app.texts.get("b")).toBe("Other")
    })

    it("applies several corrections in a row to a task that is off the page", () => {
        const { app, controller, partial, final } = setUp({ a: "" })

        app.focus("a")
        controller.start("a", { start: 0, end: 0 })
        partial("recognise")
        app.hide("a")
        controller.stop("focus")

        partial("recognise", "speech")
        final("Recognise", "speech", "today")

        expect(app.texts.get("a")).toBe("Recognise speech today")
    })

    it("does not touch focus or selection while the input is off the page", () => {
        const { app, controller, partial, final } = setUp({ a: "Fix " })

        app.focus("a")
        controller.start("a", { start: 4, end: 4 })
        partial("the", "bug")
        const input = app.inputs.get("a")!
        const selectionCalls = input.setSelectionRange.mock.calls.length

        app.hide("a")
        controller.stop("focus")
        final("the", "Bug.")

        expect(input.setSelectionRange).toHaveBeenCalledTimes(selectionCalls)
        expect(input.value).toBe("Fix the bug")
    })

    it("keeps the selection saved for a hidden task pointing at the same text", () => {
        const { app, controller, partial, final } = setUp({ a: " tail" })

        app.focus("a")
        controller.start("a", { start: 0, end: 0 })
        partial("bug")
        expect(app.texts.get("a")).toBe("bug tail")

        app.hide("a")
        app.savedSelections.set("a", { start: 4, end: 8 })
        controller.stop("focus")
        final("bugs")

        const saved = app.savedSelections.get("a")!
        expect(app.texts.get("a")).toBe("bugs tail")
        expect(app.texts.get("a")!.slice(saved.start, saved.end)).toBe("tail")
    })

    it("writes through the input again once the task is back on the page", () => {
        const { app, controller, partial, final } = setUp({ a: "" })

        app.focus("a")
        controller.start("a", { start: 0, end: 0 })
        partial("hello")
        app.hide("a")
        controller.stop("focus")
        partial("hello", "world")

        app.show("a")
        final("Hello", "world")

        expect(app.inputs.get("a")!.value).toBe("Hello world")
        expect(app.texts.get("a")).toBe("Hello world")
    })

    it("stops writing to a task that has been deleted", () => {
        const { app, controller, partial, final } = setUp({ a: "Fix " })

        app.focus("a")
        controller.start("a", { start: 4, end: 4 })
        partial("the", "bug")

        controller.removeTarget("a")
        app.targets.forget("a")
        app.remove("a")
        final("the", "Bug.")

        expect(app.texts.has("a")).toBe(false)
        expect(app.targets.get("a")).toBeUndefined()
    })

    it("stops writing to a task that was reset, even though a task with its id still exists", () => {
        const { app, controller, partial, final } = setUp({ a: "Fix " })

        app.focus("a")
        controller.start("a", { start: 4, end: 4 })
        partial("the", "bug")

        // Resetting replaces the task with a fresh one that reuses its id.
        controller.removeTarget("a")
        app.targets.forget("a")
        app.texts.set("a", "Design UI")
        app.show("a")
        final("the", "Bug.")

        expect(app.texts.get("a")).toBe("Design UI")
    })

    it("has no target for a task that never existed", () => {
        expect(setUp({ a: "Fix" }).app.targets.get("missing")).toBeUndefined()
    })
})
