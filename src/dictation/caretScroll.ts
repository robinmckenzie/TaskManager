// Keeps a little text visible beyond the caret, and absorbs small differences
// between measured and rendered text widths.
const CARET_MARGIN_PX = 12

let measuringContext: CanvasRenderingContext2D | null | undefined

/**
 * Returns the horizontal scroll offset that brings a caret into view, moving
 * as little as possible. Offsets are in pixels from the start of the text.
 */
export const getScrollLeftForCaret = (
    caretX: number,
    scrollLeft: number,
    visibleWidth: number,
    margin: number = CARET_MARGIN_PX,
): number => {
    if (caretX - margin < scrollLeft) {
        return Math.max(0, caretX - margin)
    }

    if (caretX + margin > scrollLeft + visibleWidth) {
        return caretX + margin - visibleWidth
    }

    return scrollLeft
}

const measureTextWidth = (input: HTMLInputElement, text: string): number | undefined => {
    measuringContext ??= document.createElement("canvas").getContext("2d")

    if (!measuringContext) {
        return undefined
    }

    const style = getComputedStyle(input)
    measuringContext.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`

    return measuringContext.measureText(text).width
}

/**
 * Scrolls a single-line input so its caret is visible. Browsers do this for
 * typing, but not when the value and selection are set from script.
 */
export const scrollCaretIntoView = (input: HTMLInputElement): void => {
    const caretIndex = input.selectionEnd ?? input.value.length
    const textWidth = measureTextWidth(input, input.value.slice(0, caretIndex))

    if (textWidth === undefined) {
        return
    }

    const caretX = (parseFloat(getComputedStyle(input).paddingLeft) || 0) + textWidth
    const scrollLeft = getScrollLeftForCaret(caretX, input.scrollLeft, input.clientWidth)

    if (scrollLeft !== input.scrollLeft) {
        input.scrollLeft = scrollLeft
    }
}
