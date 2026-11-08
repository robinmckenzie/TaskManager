import type { TextRange } from "./insertionText"

/**
 * The page elements that dictation can write into: a single-line input or a
 * text area. Both have the same value and selection, so dictation treats them
 * alike. Only the caret needs different care (see caretScroll.ts).
 */
export type DictationField = HTMLInputElement | HTMLTextAreaElement

/** The parts of a field that focusing it with its saved selection uses. */
export interface FocusableField {
    value: string
    focus(): void
    setSelectionRange(start: number, end: number): void
}

/** Whether an element is a text area, as opposed to a single-line input. */
export const isTextArea = (element: DictationField): element is HTMLTextAreaElement =>
    element.localName === "textarea"

/** The id of the first entry holding `element`, or undefined when none does. */
export const findFieldId = <T extends object>(
    elements: Map<string, T>,
    element: object | null,
): string | undefined =>
    [...elements].find(([, candidate]) => candidate === element)?.[0]

/**
 * Focuses a field, restoring its last cursor position or selection, clamped to
 * the text it has now, or putting the cursor at the end when there is none. Does
 * nothing when the field already has focus.
 */
export const focusFieldWithSavedSelection = (
    field: FocusableField,
    saved: TextRange | undefined,
    isFocused: boolean,
): void => {
    if (isFocused) {
        return
    }

    const length = field.value.length
    field.focus()
    field.setSelectionRange(
        Math.min(saved?.start ?? length, length),
        Math.min(saved?.end ?? length, length),
    )
}
