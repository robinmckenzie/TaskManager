import { addDays, format, getDay, isBefore, isValid, startOfDay } from "date-fns"

/*
 * Reads a described task, such as "Send the proposal, due tomorrow, high
 * priority, assigned to Aaron", using a small set of guided English phrases.
 * README lists the phrases. Matching ignores capitals and punctuation.
 *
 * The title is the words before the description's trailing run of
 * instructions. An instruction that ordinary words follow is title wording, so
 * "Review the high priority policy" is all title.
 */

export type InstructionField = "dueDate" | "priority" | "userId"

export interface DescriptionAssignee {
    id: string
    name: string
}

/** A guided phrase that sets a field. `start` and `end` are text offsets. */
export interface DescriptionInstruction {
    field: InstructionField
    /** A due date as yyyy-MM-dd or "" for none, a priority from 1 to 5, or an assignee id. */
    value: string | number
    start: number
    end: number
    wording: string
    /** Whether the value depends on the reference day, as "due tomorrow" does. */
    isRelative: boolean
}

export type UncertaintyReason =
    | "not_understood"
    | "date_does_not_exist"
    | "date_in_past"

/** Wording that begins a guided phrase but does not complete a supported one. */
export interface DescriptionUncertainty {
    /** Stays the same while the wording does, so that an acceptance can last. */
    key: string
    field: InstructionField
    reason: UncertaintyReason
    start: number
    end: number
    wording: string
    /** Whether the wording was left in the title. */
    isInTitle: boolean
}

export interface DescriptionInterpretation {
    title: string
    /** The instructions in effect, in text order. A later one wins for its field. */
    instructions: DescriptionInstruction[]
    uncertainties: DescriptionUncertainty[]
}

interface Word {
    text: string
    start: number
    end: number
}

type Match =
    | { kind: "instruction"; length: number; field: InstructionField; value: string | number; isRelative: boolean }
    | { kind: "uncertain"; length: number; field: InstructionField; reason: UncertaintyReason }

type Unit =
    | (Match & { from: number })
    | { kind: "word" | "connector"; from: number; length: 1 }

interface DateValue {
    length: number
    date?: string
    reason?: UncertaintyReason
    isRelative: boolean
}

const PRIORITY_WORDS: Record<string, number> = { high: 1, medium: 3, low: 5 }
const PRIORITY_NUMBERS: Record<string, number> = {
    "1": 1, "2": 2, "3": 3, "4": 4, "5": 5,
    one: 1, two: 2, three: 3, four: 4, five: 5,
}
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
const MONTHS = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
]
const CONNECTORS = ["no", "actually"]
/** How many unrecognised words after a cue are still taken as a failed instruction. */
const MAX_UNCERTAIN_WORDS = 2
/** Far enough ahead to reach the next 29 February from any day. */
const YEARS_TO_SEARCH = 8

const splitIntoWords = (text: string): Word[] =>
    [...text.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu)].map((match) => ({
        text: match[0].toLowerCase(),
        start: match.index,
        end: match.index + match[0].length,
    }))

const formatDate = (date: Date): string => format(date, "yyyy-MM-dd")

/** The date for a day, month and year, or undefined when there is no such date. */
const createDate = (year: number, month: number, day: number): Date | undefined => {
    const date = new Date(year, month, day)

    return isValid(date) && date.getFullYear() === year && date.getMonth() === month && date.getDate() === day
        ? date
        : undefined
}

const readDay = (word: string | undefined): number | undefined => {
    const day = word?.match(/^(\d{1,2})(?:st|nd|rd|th)?$/)

    return day ? Number(day[1]) : undefined
}

const readMonth = (word: string | undefined): number | undefined => {
    const month = word === undefined ? -1 : MONTHS.indexOf(word)

    return month < 0 ? undefined : month
}

const readYear = (word: string | undefined): number | undefined =>
    word && /^\d{4}$/.test(word) ? Number(word) : undefined

/**
 * Reads a day and month, in either order, with an optional year. Without a
 * year it is the next such date on or after the reference day.
 */
const readCalendarDate = (words: readonly string[], from: number, referenceDay: Date): DateValue | undefined => {
    let index = from
    let day: number | undefined
    let month = readMonth(words[index])

    if (month !== undefined) {
        index += 1
        index += words[index] === "the" ? 1 : 0
        day = readDay(words[index])
        index += 1
    } else {
        index += words[index] === "the" ? 1 : 0
        day = readDay(words[index])
        index += 1
        index += words[index] === "of" ? 1 : 0
        month = readMonth(words[index])
        index += 1
    }

    if (day === undefined || month === undefined) {
        return undefined
    }

    const year = readYear(words[index])

    if (year !== undefined) {
        const date = createDate(year, month, day)
        const reason = date ? "date_in_past" : "date_does_not_exist"

        return date && !isBefore(date, referenceDay)
            ? { length: index + 1 - from, date: formatDate(date), isRelative: false }
            : { length: index + 1 - from, reason, isRelative: false }
    }

    for (let offset = 0; offset <= YEARS_TO_SEARCH; offset += 1) {
        const date = createDate(referenceDay.getFullYear() + offset, month, day)

        if (date && !isBefore(date, referenceDay)) {
            return { length: index - from, date: formatDate(date), isRelative: true }
        }
    }

    return { length: index - from, reason: "date_does_not_exist", isRelative: true }
}

const readDateValue = (words: readonly string[], from: number, referenceDay: Date): DateValue | undefined => {
    const word = words[from]

    if (word === "today" || word === "tomorrow") {
        const date = addDays(referenceDay, word === "today" ? 0 : 1)

        return { length: 1, date: formatDate(date), isRelative: true }
    }

    const weekday = word === undefined ? -1 : WEEKDAYS.indexOf(word)

    if (weekday >= 0) {
        // The next such day after the reference day, so from 1 to 7 days on.
        const daysAhead = ((weekday - getDay(referenceDay) + 6) % 7) + 1

        return { length: 1, date: formatDate(addDays(referenceDay, daysAhead)), isRelative: true }
    }

    return readCalendarDate(words, from, referenceDay)
}

const readPriorityValue = (word: string | undefined): number | undefined =>
    word === undefined ? undefined : PRIORITY_WORDS[word] ?? PRIORITY_NUMBERS[word]

/** Matches an existing assignee's whole name, preferring the longest. */
const readAssignee = (
    words: readonly string[],
    from: number,
    assignees: readonly DescriptionAssignee[],
): { length: number; id: string } | undefined => {
    const matches = assignees.flatMap((assignee) => {
        const name = splitIntoWords(assignee.name).map((word) => word.text)
        const isMatch = name.length > 0 && name.every((word, index) => words[from + index] === word)

        return isMatch ? [{ length: name.length, id: assignee.id }] : []
    })

    return matches.sort((left, right) => right.length - left.length)[0]
}

const startsWith = (words: readonly string[], from: number, ...expected: string[]): boolean =>
    expected.every((word, index) => words[from + index] === word)

interface Cue {
    field: InstructionField
    length: number
}

/** Finds the words that begin a guided phrase, such as "due on" or "change the priority to". */
const readCue = (words: readonly string[], from: number): Cue | undefined => {
    if (words[from] === "change") {
        const subject = from + (words[from + 1] === "the" ? 2 : 1)

        if (startsWith(words, subject, "priority", "to")) {
            return { field: "priority", length: subject + 2 - from }
        }

        if (startsWith(words, subject, "due", "date", "to")) {
            return { field: "dueDate", length: subject + 3 - from }
        }

        if (startsWith(words, subject, "assignee", "to")) {
            return { field: "userId", length: subject + 2 - from }
        }

        return undefined
    }

    if (words[from] === "due") {
        return { field: "dueDate", length: words[from + 1] === "on" ? 2 : 1 }
    }

    if (words[from] === "priority") {
        return { field: "priority", length: 1 }
    }

    if (startsWith(words, from, "assigned", "to") || startsWith(words, from, "assign", "to")) {
        return { field: "userId", length: 2 }
    }

    return undefined
}

/** Matches a whole guided phrase beginning at a word, or a date that cannot be used. */
const matchPhrase = (
    words: readonly string[],
    from: number,
    referenceDay: Date,
    assignees: readonly DescriptionAssignee[],
): Match | undefined => {
    if (startsWith(words, from, "no", "due", "date") || startsWith(words, from, "clear", "due", "date")) {
        return { kind: "instruction", length: 3, field: "dueDate", value: "", isRelative: false }
    }

    if (startsWith(words, from, "clear", "the", "due", "date")) {
        return { kind: "instruction", length: 4, field: "dueDate", value: "", isRelative: false }
    }

    const wordPriority = words[from] === undefined ? undefined : PRIORITY_WORDS[words[from]]

    if (wordPriority !== undefined && words[from + 1] === "priority") {
        return { kind: "instruction", length: 2, field: "priority", value: wordPriority, isRelative: false }
    }

    const cue = readCue(words, from)

    if (!cue) {
        return undefined
    }

    const valueFrom = from + cue.length

    if (cue.field === "priority") {
        const priority = readPriorityValue(words[valueFrom])

        return priority === undefined
            ? undefined
            : { kind: "instruction", length: cue.length + 1, field: "priority", value: priority, isRelative: false }
    }

    if (cue.field === "userId") {
        const assignee = readAssignee(words, valueFrom, assignees)

        return assignee && {
            kind: "instruction",
            length: cue.length + assignee.length,
            field: "userId",
            value: assignee.id,
            isRelative: false,
        }
    }

    const date = readDateValue(words, valueFrom, referenceDay)

    if (!date) {
        return undefined
    }

    return date.date === undefined
        ? { kind: "uncertain", length: cue.length + date.length, field: "dueDate", reason: date.reason ?? "not_understood" }
        : {
              kind: "instruction",
              length: cue.length + date.length,
              field: "dueDate",
              value: date.date,
              isRelative: date.isRelative,
          }
}

const isConnector = (word: string | undefined): boolean => word !== undefined && CONNECTORS.includes(word)

/**
 * Splits the words into guided phrases, failed phrases and ordinary words. A
 * cue is a failed phrase when at most two unrecognised words follow it and
 * then the description ends or another phrase, whole or failed, begins.
 */
const splitIntoUnits = (
    words: readonly string[],
    referenceDay: Date,
    assignees: readonly DescriptionAssignee[],
): Unit[] => {
    const match = (from: number): Match | undefined => matchPhrase(words, from, referenceDay, assignees)
    // The phrase, whole or failed, that begins at each word. Worked out from
    // the end, because whether a cue has failed depends on what follows it.
    const phrases: (Match | undefined)[] = []
    const beginsPhrase = (from: number): boolean =>
        phrases[from] !== undefined || (isConnector(words[from]) && phrases[from + 1] !== undefined)

    for (let from = words.length - 1; from >= 0; from -= 1) {
        const cue = readCue(words, from)
        phrases[from] = match(from)

        for (let extra = 1; !phrases[from] && cue && extra <= MAX_UNCERTAIN_WORDS; extra += 1) {
            const end = from + cue.length + extra

            if (end === words.length || (end < words.length && beginsPhrase(end))) {
                phrases[from] = { kind: "uncertain", length: end - from, field: cue.field, reason: "not_understood" }
            }
        }
    }

    const units: Unit[] = []
    let index = 0

    while (index < words.length) {
        const phrase = phrases[index]
        const unit: Unit = phrase ? { ...phrase, from: index } : { kind: "word", from: index, length: 1 }

        units.push(unit)
        index += unit.length
    }

    return units.map((unit, position): Unit => {
        const next = units[position + 1]
        const isBeforePhrase = next?.kind === "instruction" || next?.kind === "uncertain"

        return unit.kind === "word" && isConnector(words[unit.from]) && isBeforePhrase
            ? { kind: "connector", from: unit.from, length: 1 }
            : unit
    })
}

const tidyTitle = (text: string): string => text.replace(/\s+/g, " ").trim()

export const interpretDescription = (
    text: string,
    referenceDay: Date,
    assignees: readonly DescriptionAssignee[],
): DescriptionInterpretation => {
    const words = splitIntoWords(text)
    const units = splitIntoUnits(words.map((word) => word.text), startOfDay(referenceDay), assignees)
    const getSpan = (unit: Unit) => {
        const start = words[unit.from].start
        const end = words[unit.from + unit.length - 1].end

        return { start, end, wording: text.slice(start, end) }
    }

    // The trailing run of phrases and connectors, which ordinary words end.
    let trailingFrom = units.length

    while (trailingFrom > 0 && units[trailingFrom - 1].kind !== "word") {
        trailingFrom -= 1
    }

    // The title runs up to the first instruction of that run, so a failed
    // phrase directly after the title words stays in the title.
    const firstInstruction = units.findIndex(
        (unit, position) => position >= trailingFrom && unit.kind === "instruction",
    )
    let titleUnits = firstInstruction < 0 ? units.length : firstInstruction

    // A connector before that instruction, as in "no, low priority", is not title wording.
    while (firstInstruction >= 0 && titleUnits > trailingFrom && units[titleUnits - 1].kind === "connector") {
        titleUnits -= 1
    }

    const instructions: DescriptionInstruction[] = []
    const uncertainties: DescriptionUncertainty[] = []
    const keyCounts = new Map<string, number>()

    units.forEach((unit, position) => {
        if (position < trailingFrom) {
            return
        }

        if (unit.kind === "instruction" && position >= titleUnits) {
            instructions.push({
                field: unit.field,
                value: unit.value,
                isRelative: unit.isRelative,
                ...getSpan(unit),
            })
        } else if (unit.kind === "uncertain") {
            const wordsKey = words.slice(unit.from, unit.from + unit.length).map((word) => word.text).join(" ")
            const baseKey = `${unit.field}:${wordsKey}`
            const count = (keyCounts.get(baseKey) ?? 0) + 1
            keyCounts.set(baseKey, count)

            uncertainties.push({
                key: count === 1 ? baseKey : `${baseKey}#${count}`,
                field: unit.field,
                reason: unit.reason,
                isInTitle: position < titleUnits,
                ...getSpan(unit),
            })
        }
    })

    const titleEnd = titleUnits < units.length ? words[units[titleUnits].from].start : text.length
    const titleText = text.slice(0, titleEnd)

    return {
        // Punctuation that only separated the title from its instructions goes.
        title: tidyTitle(titleUnits < units.length ? titleText.replace(/[\s.,;:–—-]+$/, "") : titleText),
        instructions,
        uncertainties,
    }
}
