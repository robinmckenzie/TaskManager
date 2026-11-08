import { describe, expect, it, vi } from "vitest"
import { DictationController } from "./dictationController"
import type { DictationSessionListener } from "./dictationSession"
import { focusFieldWithSavedSelection } from "./dictationFields"
import { createDictationTargets, getInputSelection } from "./dictationTargets"
import type { TargetInput } from "./dictationTargets"
import type { TextRange, TranscriptToken } from "./insertionText"

/*
 * Dictation writes into single-line inputs and text areas through the same
 * targets and controller. These tests run the same scenarios against a stand-in
 * for each, driven by synthetic recognition results (no live service).
 */

type FieldKind = "input" | "textarea"

interface FakeField extends TargetInput {
    localName: FieldKind
    setSelectionRange: ReturnType<typeof vi.fn<(start: number, end: number) => void>>
    focus(): void
}

const createApp = (kind: FieldKind, initial: Record<string, string>) => {
    const texts = new Map(Object.entries(initial))
    const fields = new Map<string, FakeField>()
    const savedSelections = new Map<string, TextRange>()
    const revealed: FakeField[] = []
    let focusedId: string | undefined

    Object.entries(initial).forEach(([id, text]) => {
        const field: FakeField = {
            localName: kind,
            value: text,
            selectionStart: text.length,
            selectionEnd: text.length,
            setSelectionRange: vi.fn((start: number, end: number) => {
                field.selectionStart = start
                field.selectionEnd = end
            }),
            focus: () => {
                focusedId = id
            },
        }
        fields.set(id, field)
    })

    const targets = createDictationTargets<FakeField>({
        getInput: (id) => fields.get(id),
        getText: (id) => texts.get(id),
        setText: (id, text) => {
            texts.set(id, text)

            const field = fields.get(id)

            if (field) {
                field.value = text
            }
        },
        isFocused: (field) => focusedId !== undefined && fields.get(focusedId) === field,
        revealCaret: (field) => revealed.push(field),
        savedSelections,
    })

    return {
        texts,
        fields,
        savedSelections,
        targets,
        revealed,
        /** The user clicks into a field, leaving the previous one. */
        moveFocus: (id: string) => {
            const previous = focusedId !== undefined ? fields.get(focusedId) : undefined

            if (previous && focusedId !== undefined) {
                savedSelections.set(focusedId, getInputSelection(previous))
            }

            focusedId = id
        },
        /** The user types, as an input event does: the field changes, then the app. */
        type: (id: string, value: string) => {
            fields.get(id)!.value = value
            texts.set(id, value)
        },
    }
}

const setUp = (kind: FieldKind, initial: Record<string, string>) => {
    const app = createApp(kind, initial)
    let listener!: DictationSessionListener
    const states: string[] = []
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
        onStateChange: (state) => states.push(`${state.phase}:${state.targetId}`),
        onAudioLevel: () => undefined,
    })
    const words = (...contents: string[]): TranscriptToken[] =>
        contents.map((content, index) => ({ content, startTime: index * 0.1 }))

    return {
        app,
        controller,
        states,
        partial: (...contents: string[]) => listener.onTranscript(false, words(...contents)),
        final: (...contents: string[]) => listener.onTranscript(true, words(...contents)),
        /** What the app does when a user edit reaches a title (handleTextChange in App.tsx). */
        userEdits: (id: string, value: string) => {
            controller.recordUserEdit(id, app.texts.get(id)!, value)
            app.type(id, value)
        },
    }
}

describe.each<FieldKind>(["input", "textarea"])("dictation into a %s", (kind) => {
    it("inserts at the caret like typing, and puts the caret after the text", () => {
        const { app, controller, partial } = setUp(kind, { a: "Fix bug" })
        app.moveFocus("a")
        app.fields.get("a")!.setSelectionRange(4, 4)

        controller.start("a", getInputSelection(app.fields.get("a")!))
        partial("the")

        expect(app.texts.get("a")).toBe("Fix the bug")
        expect(getInputSelection(app.fields.get("a")!).start).toBe(app.texts.get("a")!.indexOf("the") + 3)
    })

    it("inserts over a selection", () => {
        const { app, controller, partial, final } = setUp(kind, { a: "Fix old bug" })
        app.moveFocus("a")
        app.fields.get("a")!.setSelectionRange(4, 7)

        controller.start("a", getInputSelection(app.fields.get("a")!))
        partial("the")
        final("the")

        expect(app.texts.get("a")).toBe("Fix the bug")
    })

    it("asks for the caret to be revealed after each write into the focused field", () => {
        const { app, controller, partial } = setUp(kind, { a: "" })
        app.moveFocus("a")

        controller.start("a", { start: 0, end: 0 })
        partial("hello")
        partial("hello", "world")

        expect(app.revealed.length).toBeGreaterThanOrEqual(2)
        expect(app.revealed.every((field) => field === app.fields.get("a"))).toBe(true)
        expect(app.revealed.every((field) => field.localName === kind)).toBe(true)
    })

    it("restores the selection a field had when it lost focus", () => {
        const { app } = setUp(kind, { a: "Fix the bug", b: "Other" })
        app.moveFocus("a")
        app.fields.get("a")!.setSelectionRange(4, 7)
        app.moveFocus("b")

        const field = app.fields.get("a")!
        field.setSelectionRange(0, 0)
        focusFieldWithSavedSelection(field, app.savedSelections.get("a"), false)

        expect(getInputSelection(field)).toEqual({ start: 4, end: 7 })
    })

    it("sends speech to the field that takes focus", () => {
        const { app, controller, partial, final } = setUp(kind, { a: "One ", b: "Two " })
        app.moveFocus("a")
        controller.start("a", { start: 4, end: 4 })
        partial("first")
        final("first")

        app.moveFocus("b")
        controller.moveInsertionPoint("b", getInputSelection(app.fields.get("b")!))
        partial("second")
        final("second")

        expect(app.texts.get("a")).toBe("One first")
        expect(app.texts.get("b")).toBe("Two second")
    })

    it("keeps provisional text in place when the user types before it", () => {
        const { app, controller, partial, final, userEdits } = setUp(kind, { a: "bug" })
        app.moveFocus("a")
        controller.start("a", { start: 3, end: 3 })
        partial("fix")
        expect(app.texts.get("a")).toBe("bug fix")

        // The user types at the start while "fix" is still provisional.
        userEdits("a", "The bug fix")
        partial("fixes")
        final("fixes")

        expect(app.texts.get("a")).toBe("The bug fixes")
    })

    it("records an edit with the value actually stored, so later insertion stays aligned", () => {
        const { app, controller, partial, final, userEdits } = setUp(kind, { a: "abc" })
        app.moveFocus("a")
        controller.start("a", { start: 3, end: 3 })

        userEdits("a", "XYabc")
        partial("done")
        final("done")

        expect(app.texts.get("a")).toBe("XYabc done")
    })

    it("applies a late correction after dictation has stopped", () => {
        const { app, controller, partial, final } = setUp(kind, { a: "" })
        app.moveFocus("a")
        controller.start("a", { start: 0, end: 0 })
        partial("recognise", "speech")

        controller.stop("user")
        final("Recognise", "speech.")

        expect(app.texts.get("a")).toBe("Recognise speech.")
    })

    it("still settles text after the field leaves the page", () => {
        const { app, controller, partial, final } = setUp(kind, { a: "Fix " })
        app.moveFocus("a")
        controller.start("a", { start: 4, end: 4 })
        partial("the", "bug")

        app.fields.delete("a")
        controller.stop("focus")
        final("the", "Bug.")

        expect(app.texts.get("a")).toBe("Fix the Bug.")
    })

    it("stops when the task being dictated into is deleted", () => {
        const { app, controller } = setUp(kind, { a: "Fix " })
        app.moveFocus("a")
        controller.start("a", { start: 4, end: 4 })

        controller.removeTarget("a")

        expect(controller.isActive).toBe(false)
    })

    it("stops writing into a reset task that reuses an id", () => {
        const { app, controller, partial, final } = setUp(kind, { a: "Fix " })
        app.moveFocus("a")
        controller.start("a", { start: 4, end: 4 })
        partial("the", "bug")

        controller.removeTarget("a")
        app.targets.forget("a")
        app.texts.set("a", "Design UI")
        app.fields.get("a")!.value = "Design UI"
        final("the", "Bug.")

        expect(app.texts.get("a")).toBe("Design UI")
    })
})
