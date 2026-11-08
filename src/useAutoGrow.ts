import { useLayoutEffect } from "react"
import type { RefObject } from "react"

/**
 * Keeps a text area exactly tall enough for its text, so that a long title
 * wraps in full and never scrolls or clips. It measures again when the text
 * changes and when the area's width changes (the window is resized), because
 * either can change where lines wrap.
 */
export const useAutoGrow = (ref: RefObject<HTMLTextAreaElement | null>, text: string): void => {
    useLayoutEffect(() => {
        const area = ref.current

        if (!area) {
            return
        }

        const fit = (): void => {
            area.style.height = "auto"
            // scrollHeight leaves out the borders that box-sizing: border-box adds back.
            const borders = area.offsetHeight - area.clientHeight
            area.style.height = `${area.scrollHeight + borders}px`
        }

        fit()

        if (typeof ResizeObserver === "undefined") {
            return
        }

        let lastWidth = area.offsetWidth
        const observer = new ResizeObserver((): void => {
            if (area.offsetWidth !== lastWidth) {
                lastWidth = area.offsetWidth
                fit()
            }
        })
        observer.observe(area)

        return (): void => observer.disconnect()
    }, [ref, text])
}
