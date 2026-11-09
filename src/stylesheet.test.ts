import { expect, it } from "vitest"
import css from "./index.css?raw"

const token = (name: string): string => {
    const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))
    expect(match, `token --${name}`).not.toBeNull()
    return match![1]
}

const luminance = (hex: string): number => {
    const [r, g, b] = [1, 3, 5].map((start) => {
        const channel = parseInt(hex.slice(start, start + 2), 16) / 255
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const contrast = (a: string, b: string): number => {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (light + 0.05) / (dark + 0.05)
}

it("keeps text colours at WCAG AA (4.5:1) on the page and the sidebar", () => {
    for (const background of ["page", "sidebar"]) {
        for (const text of ["text", "muted", "subtle", "accent", "danger"]) {
            expect(contrast(token(text), token(background)), `${text} on ${background}`).toBeGreaterThanOrEqual(4.5)
        }
    }
})

it("keeps each due state's text at 4.5:1 on the page, and the urgent ones on their tint", () => {
    for (const state of ["overdue", "soon", "week", "later", "none", "done"]) {
        expect(contrast(token(state), token("page")), state).toBeGreaterThanOrEqual(4.5)
    }
    expect(contrast(token("overdue"), token("overdue-tint"))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(token("soon"), token("soon-tint"))).toBeGreaterThanOrEqual(4.5)
})

it("keeps control edges and the focus ring at 3:1 on the page and the sidebar", () => {
    for (const background of ["page", "sidebar"]) {
        expect(contrast(token("edge"), token(background)), `edge on ${background}`).toBeGreaterThanOrEqual(3)
        expect(contrast(token("accent"), token(background)), `accent on ${background}`).toBeGreaterThanOrEqual(3)
    }
})

it("shows a visible focus ring on every control by default", () => {
    expect(css).toMatch(/:focus-visible\s*\{\s*outline:\s*2px solid var\(--accent\)/)
})

it("stops transitions under reduced motion", () => {
    const block = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/)?.[0]
    expect(block).toBeDefined()
    expect(block).toContain("transition-duration: 0s !important")
})

it("shows the assignee as a photo and drops the short date up to 1180 px", () => {
    const block = css.match(/@media \(max-width: 1180px\)\s*\{\s*\/\* The assignee[\s\S]*?\n\}/)?.[0]
    expect(block).toBeDefined()
    expect(block).toContain(".task-assignee-name")
    expect(block).toMatch(/\.task-due-date\s*\{\s*display:\s*none/)
    // The name is hidden visually, not removed, so screen readers still get it.
    expect(block).not.toMatch(/\.task-assignee-name\s*\{[^}]*display:\s*none/)
})
