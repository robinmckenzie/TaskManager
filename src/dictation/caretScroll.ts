import { isTextArea } from "./dictationFields"
import type { DictationField } from "./dictationFields"

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

/**
 * How far the page must scroll vertically to bring a caret line into the
 * window, moving as little as possible. Positive scrolls down. Positions are in
 * pixels from the top of the window.
 */
export const getPageScrollForCaretLine = (
    lineTop: number,
    lineBottom: number,
    windowHeight: number,
    margin: number = CARET_MARGIN_PX,
): number => {
    if (lineTop - margin < 0) {
        return lineTop - margin
    }

    if (lineBottom + margin > windowHeight) {
        return lineBottom + margin - windowHeight
    }

    return 0
}

/** Style properties that decide where a text area wraps its text. */
const MIRRORED_PROPERTIES = [
    "boxSizing", "width", "fontFamily", "fontSize", "fontStyle", "fontWeight", "letterSpacing",
    "lineHeight", "textTransform", "wordSpacing", "textIndent", "tabSize",
    "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
] as const

/**
 * The caret's line in a text area, in window coordinates. Found by laying the
 * text before the caret out in a hidden copy of the area and noting where it ends.
 */
const measureCaretLine = (area: HTMLTextAreaElement): { top: number; bottom: number } => {
    const style = getComputedStyle(area)
    const mirror = document.createElement("div")

    for (const property of MIRRORED_PROPERTIES) {
        mirror.style[property] = style[property]
    }

    mirror.style.position = "absolute"
    mirror.style.visibility = "hidden"
    mirror.style.top = "0"
    mirror.style.left = "-9999px"
    mirror.style.whiteSpace = "pre-wrap"
    mirror.style.overflowWrap = "break-word"
    mirror.textContent = area.value.slice(0, area.selectionEnd ?? area.value.length)

    const marker = document.createElement("span")
    marker.textContent = "\u200b"
    mirror.append(marker)
    document.body.append(mirror)

    const lineHeight = parseFloat(style.lineHeight) || marker.offsetHeight
    const markerTop = marker.offsetTop
    mirror.remove()

    const areaTop = area.getBoundingClientRect().top + (parseFloat(style.borderTopWidth) || 0)

    return { top: areaTop + markerTop - area.scrollTop, bottom: areaTop + markerTop - area.scrollTop + lineHeight }
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
 *
 * A text area wraps its text and grows to fit it, so nothing inside it scrolls.
 * Instead the area that scrolls the list is scrolled (the main area, which owns
 * the scrollbar, or the page when there is no such area), when the caret's line
 * is outside its visible part.
 */
export const scrollCaretIntoView = (input: DictationField): void => {
    if (isTextArea(input)) {
        const line = measureCaretLine(input)
        const container = input.closest<HTMLElement>(".app-content")
        const containerTop = container ? container.getBoundingClientRect().top : 0
        const visibleHeight = container ? container.clientHeight : window.innerHeight
        const delta = getPageScrollForCaretLine(
            line.top - containerTop,
            line.bottom - containerTop,
            visibleHeight,
        )

        if (delta !== 0) {
            if (container) {
                container.scrollBy(0, delta)
            } else {
                window.scrollBy(0, delta)
            }
        }

        return
    }

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
