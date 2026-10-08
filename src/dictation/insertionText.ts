export interface TextRange {
    start: number
    end: number
}

/** Replaces the text from `start` to `end` with `insert`. */
export interface TextEdit {
    start: number
    end: number
    insert: string
}

export interface TranscriptToken {
    content: string
    startTime: number
    attachesTo?: "next" | "previous" | "none" | "both"
}

export interface PreparedInsertion {
    edit: TextEdit
    position: number
}

const isSpaceOrEdge = (character: string | undefined): boolean =>
    character === undefined || /\s/.test(character)

export const normaliseRange = ({ start, end }: TextRange): TextRange => ({
    start: Math.min(start, end),
    end: Math.max(start, end),
})

export const applyEdit = (text: string, { start, end, insert }: TextEdit): string =>
    text.slice(0, start) + insert + text.slice(end)

/**
 * Prepares the area for a new speech insertion: deletes any selection and adds
 * a separating space before and after the insertion point where the adjacent
 * existing text is not already a space.
 */
export const prepareInsertion = (text: string, range: TextRange): PreparedInsertion => {
    const { start, end } = normaliseRange(range)
    const needsLeadingSpace = !isSpaceOrEdge(text[start - 1])
    const needsTrailingSpace = !isSpaceOrEdge(text[end])
    const leading = needsLeadingSpace ? " " : ""
    const trailing = needsTrailingSpace ? " " : ""

    return {
        edit: { start, end, insert: leading + trailing },
        position: start + leading.length,
    }
}

const attachesToPrevious = (token: TranscriptToken): boolean =>
    token.attachesTo === "previous" || token.attachesTo === "both"

const attachesToNext = (token: TranscriptToken): boolean =>
    token.attachesTo === "next" || token.attachesTo === "both"

/** Joins recognised words and punctuation into display text. */
export const composeTokens = (tokens: readonly TranscriptToken[]): string =>
    tokens.reduce((text, token, index) => {
        if (index === 0) {
            return token.content
        }

        const previous = tokens[index - 1]
        const separator = attachesToPrevious(token) || attachesToNext(previous) ? "" : " "

        return text + separator + token.content
    }, "")

/** Finds the single edit that turns `before` into `after`. */
export const findEdit = (before: string, after: string): TextEdit => {
    const shorterLength = Math.min(before.length, after.length)
    let prefix = 0

    while (prefix < shorterLength && before[prefix] === after[prefix]) {
        prefix += 1
    }

    let suffix = 0

    while (
        suffix < shorterLength - prefix &&
        before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
    ) {
        suffix += 1
    }

    return {
        start: prefix,
        end: before.length - suffix,
        insert: after.slice(prefix, after.length - suffix),
    }
}

const getEditDelta = ({ start, end, insert }: TextEdit): number =>
    insert.length - (end - start)

/** Moves a cursor position to account for an edit elsewhere in the text. */
export const shiftPosition = (position: number, edit: TextEdit): number => {
    if (position < edit.start) {
        return position
    }

    if (position >= edit.end) {
        return position + getEditDelta(edit)
    }

    return edit.start + edit.insert.length
}

export const shiftRange = (range: TextRange, edit: TextEdit): TextRange => ({
    start: shiftPosition(range.start, edit),
    end: shiftPosition(range.end, edit),
})

/**
 * Moves a cursor position or selection to follow a change made to the text
 * around it, given the text before and after the change.
 */
export const shiftRangeForChange = (range: TextRange, before: string, after: string): TextRange =>
    shiftRange(range, findEdit(before, after))

/**
 * Moves an area to account for an edit, or returns undefined when the edit
 * overlaps the area's existing text. Text typed immediately after an area
 * leaves the area unchanged.
 */
export const moveAreaForEdit = (area: TextRange, edit: TextEdit): TextRange | undefined => {
    if (edit.start >= area.end) {
        return area
    }

    if (edit.end <= area.start) {
        const delta = getEditDelta(edit)

        return { start: area.start + delta, end: area.end + delta }
    }

    return undefined
}
