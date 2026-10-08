import type { DictationTextTarget } from "./dictationController"
import { shiftRangeForChange } from "./insertionText"
import type { TextRange } from "./insertionText"

/** The parts of a text input that a dictation target uses. */
export interface TargetInput {
    value: string
    selectionStart: number | null
    selectionEnd: number | null
    setSelectionRange(start: number, end: number): void
}

/** What dictation targets need from the app and the page. */
export interface DictationTargetHost<Input extends TargetInput> {
    /** The target's input, while it is on the page. */
    getInput(targetId: string): Input | undefined
    /** The target's text in the app's state, or undefined once the target no longer exists. */
    getText(targetId: string): string | undefined
    /** Updates the target's text in the app's state, applying it before returning. */
    setText(targetId: string, text: string): void
    isFocused(input: Input): boolean
    revealCaret(input: Input): void
    /** The selection each target had when its input last lost focus. */
    savedSelections: Map<string, TextRange>
}

export const getInputSelection = (input: TargetInput): TextRange => ({
    start: input.selectionStart ?? input.value.length,
    end: input.selectionEnd ?? input.value.length,
})

/**
 * Provides the text targets that dictation writes into. A target stands for a
 * piece of text in the app's state, not for an input element, so it stays
 * available while its input is off the page, for example when its task is
 * filtered out. Recognised text that is still settling is then written to the
 * app's state alone, and focus and selection are only touched while the input
 * is on the page.
 */
export const createDictationTargets = <Input extends TargetInput>(host: DictationTargetHost<Input>) => {
    // Text written while a target's input is off the page, so that several
    // writes in a row build on each other without waiting for the app to render.
    const offPageTexts = new Map<string, string>()

    const shiftSavedSelection = (targetId: string, before: string, after: string): void => {
        const saved = host.savedSelections.get(targetId)

        if (saved) {
            host.savedSelections.set(targetId, shiftRangeForChange(saved, before, after))
        }
    }

    const createOnPageTarget = (targetId: string, input: Input): DictationTextTarget => ({
        getValue: () => input.value,
        getSelection: () => getInputSelection(input),
        isFocused: () => host.isFocused(input),
        writeValue: (value, selection) => {
            const before = input.value
            host.setText(targetId, value)

            if (selection) {
                input.setSelectionRange(selection.start, selection.end)
                host.revealCaret(input)
            } else {
                // Not focused: keep the selection that focusing will restore
                // pointing at the same text.
                shiftSavedSelection(targetId, before, value)
            }
        },
    })

    const createOffPageTarget = (targetId: string, text: string): DictationTextTarget => {
        const getValue = (): string => offPageTexts.get(targetId) ?? text

        return {
            getValue,
            getSelection: () => {
                const end = getValue().length

                return host.savedSelections.get(targetId) ?? { start: end, end }
            },
            isFocused: () => false,
            writeValue: (value) => {
                const before = getValue()
                offPageTexts.set(targetId, value)
                host.setText(targetId, value)
                shiftSavedSelection(targetId, before, value)
            },
        }
    }

    return {
        /** The target for an id, or undefined when it no longer exists. */
        get: (targetId: string): DictationTextTarget | undefined => {
            const input = host.getInput(targetId)

            if (input) {
                offPageTexts.delete(targetId)
                return createOnPageTarget(targetId, input)
            }

            const text = host.getText(targetId)

            if (text === undefined) {
                offPageTexts.delete(targetId)
                return undefined
            }

            return createOffPageTarget(targetId, text)
        },
        /** Drops what is remembered about a target that has been removed. */
        forget: (targetId: string): void => {
            offPageTexts.delete(targetId)
            host.savedSelections.delete(targetId)
        },
    }
}
