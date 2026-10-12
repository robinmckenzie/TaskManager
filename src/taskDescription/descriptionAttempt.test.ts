import { describe, expect, it } from "vitest"
import type { TranscriptToken } from "../dictation/insertionText"
import {
    acceptUncertainty,
    closeAttempt,
    createDescriptionAttempt,
    createFromAttempt,
    editField,
    markCaptureListening,
    readFields,
    receiveTranscript,
    settleCapture,
    startCapture,
    stopCapture,
    typeDescription,
    viewAttempt,
} from "./descriptionAttempt"
import type { DescriptionAttempt } from "./descriptionAttempt"

// Monday 12 October 2026.
const today = new Date(2026, 9, 12, 9)
const tomorrow = new Date(2026, 9, 13, 0, 1)
const assignees = [
    { id: "4", name: "Aaron" },
    { id: "1", name: "Alice" },
    { id: "2", name: "Bob" },
]

const createAttempt = (defaultUserId = "1"): DescriptionAttempt =>
    createDescriptionAttempt({ id: "attempt", referenceDay: today, assignees, defaultUserId })

/** Types text at the end of the description one character at a time, as a person does. */
const typeAtEnd = (attempt: DescriptionAttempt, text: string): DescriptionAttempt =>
    [...text].reduce((current, character) => typeDescription(current, current.text + character), attempt)

const replace = (attempt: DescriptionAttempt, from: string, to: string): DescriptionAttempt =>
    typeDescription(attempt, attempt.text.replace(from, to))

/** Recognised words, a tenth of a second apart from `startTime`. */
const words = (startTime: number, text: string): TranscriptToken[] =>
    text.split(" ").map((content, index) => ({ content, startTime: startTime + index * 0.1 }))

const listen = (attempt: DescriptionAttempt): DescriptionAttempt => {
    const started = startCapture(attempt)

    if (!started) {
        throw new Error("The capture did not start.")
    }

    return markCaptureListening(started, "en")
}

const final = (attempt: DescriptionAttempt, startTime: number, text: string): DescriptionAttempt =>
    receiveTranscript(attempt, true, words(startTime, text))

const partial = (attempt: DescriptionAttempt, startTime: number, text: string): DescriptionAttempt =>
    receiveTranscript(attempt, false, text ? words(startTime, text) : [])

const settle = (attempt: DescriptionAttempt): DescriptionAttempt => settleCapture(stopCapture(attempt))

/** Speaks a whole description in one capture that settles cleanly. */
const speak = (attempt: DescriptionAttempt, text: string): DescriptionAttempt =>
    settle(final(listen(attempt), 0, text))

const priorityOf = (attempt: DescriptionAttempt): number => readFields(attempt).priority

describe("a new attempt", () => {
    it("has a blank title, no due date, priority 3 and the default assignee", () => {
        const view = viewAttempt(createAttempt("2"), today)

        expect(view.fields).toEqual({ title: "", dueDate: "", priority: 3, userId: "2" })
        expect(view.blockers).toEqual(["blank_title"])
        expect(view.canCreate).toBe(false)
    })
})

describe("interpreting a description", () => {
    const storyboards: [string, Partial<ReturnType<typeof readFields>>][] = [
        [
            "Send the proposal, due tomorrow, high priority, assigned to Aaron",
            { title: "Send the proposal", dueDate: "2026-10-13", priority: 1, userId: "4" },
        ],
        ["Send the proposal, priority high", { title: "Send the proposal", priority: 1 }],
        ["Send the proposal, medium priority", { title: "Send the proposal", priority: 3 }],
        ["Send the proposal, priority low", { title: "Send the proposal", priority: 5 }],
        ["Send the proposal, high priority, low priority", { title: "Send the proposal", priority: 5 }],
        ["Send the proposal, high priority, no, low priority", { title: "Send the proposal", priority: 5 }],
        ["Send the proposal, change priority to low", { title: "Send the proposal", priority: 5 }],
        ["Review the high priority policy", { title: "Review the high priority policy", priority: 3 }],
        ["Send the proposal, due tomorrow, no, due Friday", { title: "Send the proposal", dueDate: "2026-10-16" }],
        ["Send the proposal", { title: "Send the proposal", dueDate: "", priority: 3, userId: "1" }],
    ]

    it.each(storyboards)("reads typed %s", (text, expected) => {
        expect(readFields(typeAtEnd(createAttempt(), text))).toMatchObject(expected)
    })

    it.each(storyboards)("reads spoken %s the same", (text, expected) => {
        const attempt = speak(createAttempt(), text)

        expect(attempt.text).toBe(text)
        expect(readFields(attempt)).toMatchObject(expected)
        expect(viewAttempt(attempt, today).canCreate).toBe(true)
    })

    it("develops the fields as words are recognised, keeping every word in the description", () => {
        let attempt = listen(createAttempt())

        attempt = partial(attempt, 0, "Send the proposal high")
        expect(readFields(attempt)).toMatchObject({ title: "Send the proposal high", priority: 3 })

        attempt = partial(attempt, 0, "Send the proposal high priority")
        expect(readFields(attempt)).toMatchObject({ title: "Send the proposal", priority: 1 })

        attempt = final(attempt, 0, "Send the proposal, high priority")
        attempt = partial(attempt, 1, "assigned to Aaron")
        expect(readFields(attempt)).toMatchObject({ title: "Send the proposal", priority: 1, userId: "4" })
        expect(attempt.text).toBe("Send the proposal, high priority assigned to Aaron")
    })

    it("joins recognised punctuation to the word before it", () => {
        const attempt = receiveTranscript(listen(createAttempt()), true, [
            { content: "Send", startTime: 0 },
            { content: "it", startTime: 0.1 },
            { content: ",", startTime: 0.2, attachesTo: "previous" },
            { content: "priority", startTime: 0.3 },
            { content: "2", startTime: 0.4 },
            { content: ".", startTime: 0.5, attachesTo: "previous" },
        ])

        expect(attempt.text).toBe("Send it, priority 2.")
        expect(readFields(attempt)).toMatchObject({ title: "Send it", priority: 2 })
    })
})

describe("a manual edit against the description", () => {
    it("is replaced when a typed edit changes the instruction", () => {
        let attempt = typeAtEnd(createAttempt(), "Send proposal, high priority")
        attempt = editField(attempt, "priority", 3)
        expect(priorityOf(attempt)).toBe(3)

        expect(priorityOf(replace(attempt, "high", "low"))).toBe(5)
    })

    it("is replaced when the instruction is retyped a character at a time", () => {
        let attempt = typeAtEnd(createAttempt(), "Send proposal, high priority")
        attempt = editField(attempt, "priority", 3)
        attempt = replace(attempt, "high", "")
        attempt = typeDescription(attempt, attempt.text.replace(",  priority", ", l priority"))
        attempt = replace(attempt, ", l priority", ", lo priority")

        expect(priorityOf(replace(attempt, ", lo priority", ", low priority"))).toBe(5)
    })

    it("stands when a typed edit changes other words", () => {
        let attempt = typeAtEnd(createAttempt(), "Send proposl, high priority")
        attempt = editField(attempt, "priority", 3)

        expect(priorityOf(replace(attempt, "proposl", "proposal"))).toBe(3)
    })

    it("is replaced when a typed deletion turns title wording into an instruction", () => {
        let attempt = typeAtEnd(createAttempt(), "Review the high priority policy")
        attempt = editField(attempt, "priority", 3)

        expect(priorityOf(replace(attempt, " policy", ""))).toBe(1)
    })

    it("stands while an instruction it replaced passes out of effect and back", () => {
        let attempt = typeAtEnd(createAttempt(), "Send proposal, high priority")
        attempt = editField(attempt, "priority", 3)
        attempt = typeAtEnd(attempt, ", due tomorrow")

        expect(readFields(attempt)).toMatchObject({ priority: 3, dueDate: "2026-10-13" })
    })

    it("stands when ordinary words are typed after its instruction and then deleted again", () => {
        let attempt = typeAtEnd(createAttempt(), "Send it, high priority")
        attempt = editField(attempt, "priority", 2)
        const before = attempt.text

        // The description is back as it was when the edit was made, as it
        // is after an undo, so the edit still stands.
        attempt = typeAtEnd(attempt, " policy")
        expect(priorityOf(attempt)).toBe(2)
        expect(priorityOf(typeDescription(attempt, before))).toBe(2)

        // A stray character typed and deleted leaves it standing too.
        attempt = typeDescription(typeDescription(typeDescription(attempt, before), `${before} x`), before)
        expect(priorityOf(attempt)).toBe(2)
    })

    it("counts characters as text offsets do, so an emoji does not shift what speech replaces", () => {
        let attempt = listen(typeAtEnd(createAttempt(), "📝 Send it"))
        attempt = final(attempt, 0, "high priority")
        attempt = editField(attempt, "priority", 2, 3)
        attempt = final(attempt, 4, "due tomorrow")
        expect(readFields(attempt)).toMatchObject({ priority: 2, dueDate: "2026-10-13" })

        let typed = typeDescription(createAttempt(), "📝📝 Send it, high priority")
        typed = editField(typed, "priority", 2)
        typed = typeAtEnd(typed, ", due tomorrow")
        expect(typed.moments).toHaveLength(typed.text.length)
        expect(readFields(typed)).toMatchObject({ priority: 2, dueDate: "2026-10-13" })
    })

    it("is replaced by a new instruction typed after it, with no correction word", () => {
        let attempt = typeAtEnd(createAttempt(), "Send proposal, high priority")
        attempt = editField(attempt, "priority", 3)

        expect(priorityOf(typeAtEnd(attempt, ", low priority"))).toBe(5)
    })

    it("stands when recognition revises speech from before the edit", () => {
        let attempt = partial(listen(createAttempt()), 0, "Send it high priority")
        expect(priorityOf(attempt)).toBe(1)

        attempt = editField(attempt, "priority", 2, 3)
        attempt = final(attempt, 0, "Send it low priority")

        expect(priorityOf(attempt)).toBe(2)
    })

    it("is replaced by a spoken correction, and comes back if recognition withdraws it", () => {
        let attempt = final(listen(createAttempt()), 0, "Send it high priority")
        attempt = editField(attempt, "priority", 2, 3)
        expect(priorityOf(attempt)).toBe(2)

        attempt = partial(attempt, 4, "no, low priority")
        expect(priorityOf(attempt)).toBe(5)

        attempt = partial(attempt, 4, "")
        expect(priorityOf(attempt)).toBe(2)

        attempt = final(attempt, 4, "no, low priority")
        expect(priorityOf(attempt)).toBe(5)
        expect(readFields(attempt).title).toBe("Send it")
    })

    it("is replaced by an instruction that speech completes after the edit", () => {
        let attempt = final(listen(createAttempt()), 0, "Send it high")
        attempt = editField(attempt, "priority", 2, 3)
        expect(priorityOf(attempt)).toBe(2)

        attempt = partial(attempt, 4, "priority")
        expect(priorityOf(attempt)).toBe(1)

        expect(priorityOf(partial(attempt, 4, ""))).toBe(2)
    })

    it("does not split an instruction that an edit of another field interrupts", () => {
        let attempt = final(listen(createAttempt()), 0, "Send it high")
        attempt = editField(attempt, "userId", "2", 3)
        attempt = final(attempt, 4, "priority")

        expect(readFields(attempt)).toMatchObject({ title: "Send it", priority: 1, userId: "2" })
    })

    it("does not split a connector or the title that an edit interrupts", () => {
        let attempt = final(listen(createAttempt()), 0, "Send the high priority no")
        attempt = editField(attempt, "userId", "2", 3)
        attempt = final(attempt, 4, "low priority")
        expect(readFields(attempt)).toMatchObject({ title: "Send the", priority: 5, userId: "2" })

        attempt = final(listen(createAttempt()), 0, "Send the")
        attempt = editField(attempt, "priority", 4, 3)
        attempt = final(attempt, 4, "proposal to Bob")
        expect(readFields(attempt)).toMatchObject({ title: "Send the proposal to Bob", priority: 4 })
    })

    it("made while recognition finishes stands against the late results", () => {
        let attempt = stopCapture(partial(listen(createAttempt()), 0, "Send it high priority"))
        attempt = editField(attempt, "priority", 2, undefined)
        attempt = final(attempt, 0, "Send it low priority")

        expect(priorityOf(settleCapture(attempt))).toBe(2)
    })

    it("made between captures is earlier than everything in the next capture", () => {
        let attempt = speak(createAttempt(), "Send it high priority")
        attempt = editField(attempt, "priority", 2)
        attempt = final(listen(attempt), 0, "low priority")

        expect(attempt.text).toBe("Send it high priority low priority")
        expect(priorityOf(attempt)).toBe(5)
    })

    it("stands through a later capture that leaves its instruction alone", () => {
        let attempt = speak(createAttempt(), "Send it high priority")
        attempt = editField(attempt, "priority", 2)
        attempt = settle(final(listen(attempt), 0, "due tomorrow"))

        expect(readFields(attempt)).toMatchObject({ title: "Send it", priority: 2, dueDate: "2026-10-13" })
    })

    it("keeps a typed correction's standing through a later capture", () => {
        let attempt = typeAtEnd(createAttempt(), "Review the high priority policy")
        attempt = editField(attempt, "priority", 3)
        attempt = replace(attempt, " policy", "")
        attempt = settle(final(listen(attempt), 0, "due tomorrow"))

        expect(readFields(attempt)).toMatchObject({ priority: 1, dueDate: "2026-10-13" })
    })

    it("pins an edited title against later words", () => {
        let attempt = typeAtEnd(createAttempt(), "Send proposl")
        attempt = editField(attempt, "title", "Send the proposal")
        attempt = typeAtEnd(attempt, " now, high priority")

        expect(readFields(attempt)).toMatchObject({ title: "Send the proposal", priority: 1 })
        expect(attempt.text).toBe("Send proposl now, high priority")
    })

    it("can clear a due date that the description set", () => {
        let attempt = typeAtEnd(createAttempt(), "Send it due tomorrow")
        attempt = editField(attempt, "dueDate", "")

        expect(readFields(attempt).dueDate).toBe("")
    })
})

describe("uncertainty", () => {
    const describeIt = (attempt: DescriptionAttempt, day = today): string[] =>
        viewAttempt(attempt, day).uncertainties.map((uncertainty) => uncertainty.message)

    it("blocks Create until the displayed value is accepted", () => {
        let attempt = typeAtEnd(createAttempt(), "Send it, high priority, assigned to Morgan")
        const view = viewAttempt(attempt, today)

        expect(view.fields).toMatchObject({ title: "Send it", priority: 1, userId: "1" })
        expect(view.uncertainties).toMatchObject([
            { field: "userId", message: '"assigned to Morgan" does not name an existing assignee.' },
        ])
        expect(view.blockers).toEqual(["unresolved"])
        expect(createFromAttempt(attempt, today)).toBeNull()

        attempt = acceptUncertainty(attempt, view.uncertainties[0].key)
        expect(viewAttempt(attempt, today).canCreate).toBe(true)
        expect(readFields(attempt).userId).toBe("1")
    })

    it("is resolved by editing the field in question", () => {
        let attempt = typeAtEnd(createAttempt(), "Send it, high priority, assigned to Morgan")
        attempt = editField(attempt, "userId", "2")

        expect(viewAttempt(attempt, today).uncertainties).toEqual([])
        expect(readFields(attempt).userId).toBe("2")
    })

    it("is not resolved by editing another field", () => {
        let attempt = typeAtEnd(createAttempt(), "Send it, high priority, assigned to Morgan")
        attempt = editField(attempt, "priority", 2)

        expect(viewAttempt(attempt, today).uncertainties).toHaveLength(1)
    })

    it("returns when the wording changes after acceptance, and not when other words do", () => {
        let attempt = typeAtEnd(createAttempt(), "Send it, due Blursday")
        attempt = acceptUncertainty(attempt, viewAttempt(attempt, today).uncertainties[0].key)
        expect(describeIt(attempt)).toEqual([])

        attempt = replace(attempt, "Send", "Post")
        expect(describeIt(attempt)).toEqual([])

        attempt = replace(attempt, "Blursday", "Blursdays")
        expect(describeIt(attempt)).toEqual([
            '"due Blursdays" was not understood as a due date. The words are still in the title.',
        ])
    })

    it("asks again when accepted wording is removed and later supplied again", () => {
        let attempt = typeAtEnd(createAttempt(), "Send it, high priority, due Blursday")
        attempt = acceptUncertainty(attempt, viewAttempt(attempt, today).uncertainties[0].key)
        expect(viewAttempt(attempt, today).canCreate).toBe(true)

        attempt = replace(attempt, "due Blursday", "due tomorrow")
        attempt = typeAtEnd(attempt, ", due Blursday")

        expect(describeIt(attempt)).toEqual([`"due Blursday" was not understood as a due date.`])
        expect(viewAttempt(attempt, today)).toMatchObject({ canCreate: false, fields: { dueDate: "2026-10-13" } })
    })

    it("asks again when wording settled by editing its field is supplied again", () => {
        let attempt = typeAtEnd(createAttempt(), "Send it, high priority, assigned to Morgan")
        attempt = editField(attempt, "userId", "2")
        attempt = replace(attempt, ", assigned to Morgan", "")
        expect(describeIt(attempt)).toEqual([])

        attempt = typeAtEnd(attempt, ", assigned to Morgan")
        expect(describeIt(attempt)).toHaveLength(1)
        expect(readFields(attempt).userId).toBe("2")
    })

    it("does not pass an acceptance to another phrase with the same wording", () => {
        let attempt = typeAtEnd(createAttempt(), "Send it, high priority, due Blursday, DUE BLURSDAY")
        expect(describeIt(attempt)).toHaveLength(2)

        attempt = acceptUncertainty(attempt, viewAttempt(attempt, today).uncertainties[0].key)
        expect(describeIt(attempt)).toEqual([`"DUE BLURSDAY" was not understood as a due date.`])

        // Words typed before both phrases move them without unsettling the acceptance.
        attempt = replace(attempt, "Send it", "Send it now")
        expect(describeIt(attempt)).toHaveLength(1)

        attempt = replace(attempt, "due Blursday, ", "")
        expect(attempt.text).toBe("Send it now, high priority, DUE BLURSDAY")
        expect(describeIt(attempt)).toEqual([`"DUE BLURSDAY" was not understood as a due date.`])
        expect(createFromAttempt(attempt, today)).toBeNull()
    })

    it("does not pass an acceptance between phrases that are identical", () => {
        let attempt = typeAtEnd(createAttempt(), "Send it, high priority, due Blursday, due Blursday")
        attempt = acceptUncertainty(attempt, viewAttempt(attempt, today).uncertainties[0].key)
        expect(describeIt(attempt)).toHaveLength(1)
        expect(createFromAttempt(attempt, today)).toBeNull()

        // Deleting either phrase leaves the same text, so which went is unknown.
        attempt = typeDescription(attempt, "Send it, high priority, due Blursday")

        expect(describeIt(attempt)).toEqual([`"due Blursday" was not understood as a due date.`])
        expect(createFromAttempt(attempt, today)).toBeNull()
    })

    it("ends an acceptance when another phrase with its wording is added", () => {
        let attempt = typeAtEnd(createAttempt(), "Send it, high priority, due Blursday")
        attempt = acceptUncertainty(attempt, viewAttempt(attempt, today).uncertainties[0].key)
        attempt = typeAtEnd(attempt, ", due Blursday")

        expect(describeIt(attempt)).toHaveLength(2)
    })

    it("says why a date or a priority was not used", () => {
        expect(describeIt(typeAtEnd(createAttempt(), "Send it, high priority, due 31 February"))).toEqual([
            '"due 31 February" is not a date that exists.',
        ])
        expect(describeIt(typeAtEnd(createAttempt(), "Send it, high priority, due 1 October 2020"))).toEqual([
            '"due 1 October 2020" is in the past.',
        ])
        expect(describeIt(typeAtEnd(createAttempt(), "Send it, priority six"))).toEqual([
            '"priority six" was not understood. Priority is high, medium, low or 1 to 5. ' +
                "The words are still in the title.",
        ])
    })

    it("flags a relative date once the day has changed, without moving it", () => {
        let attempt = typeAtEnd(createAttempt(), "Send it, due tomorrow")
        expect(viewAttempt(attempt, today).canCreate).toBe(true)

        const view = viewAttempt(attempt, tomorrow)
        expect(view.fields.dueDate).toBe("2026-10-13")
        expect(view.uncertainties).toMatchObject([
            {
                field: "dueDate",
                message:
                    'The day has changed since this description was started. "due tomorrow" was read as ' +
                    "Tue 13 Oct 2026.",
            },
        ])
        expect(view.canCreate).toBe(false)

        attempt = acceptUncertainty(attempt, view.uncertainties[0].key)
        expect(viewAttempt(attempt, tomorrow).canCreate).toBe(true)
    })

    it("does not flag a dated or manually set due date when the day changes", () => {
        expect(describeIt(typeAtEnd(createAttempt(), "Send it, due 15 October 2026"), tomorrow)).toEqual([])

        const edited = editField(typeAtEnd(createAttempt(), "Send it, due tomorrow"), "dueDate", "2026-10-20")
        expect(describeIt(edited, tomorrow)).toEqual([])
    })

    it("flags words left unconfirmed when recognition settles, and keeps them", () => {
        let attempt = final(listen(createAttempt()), 0, "Send it")
        attempt = settle(partial(attempt, 1, "high prior"))

        expect(attempt.text).toBe("Send it high prior")
        expect(describeIt(attempt)).toEqual([
            "The last words may be incomplete, because recognition stopped before confirming them.",
        ])
        expect(viewAttempt(attempt, today).canCreate).toBe(false)

        const accepted = acceptUncertainty(attempt, viewAttempt(attempt, today).uncertainties[0].key)
        expect(viewAttempt(accepted, today).canCreate).toBe(true)

        const corrected = typeDescription(attempt, "Send it high priority")
        expect(viewAttempt(corrected, today).canCreate).toBe(true)
        expect(priorityOf(corrected)).toBe(1)
    })

    it("names a recognition language that guided phrases are not understood in", () => {
        const start = (language: string): DescriptionAttempt => {
            const started = startCapture(createAttempt())

            return markCaptureListening(started ?? createAttempt(), language)
        }

        expect(viewAttempt(start("de"), today).unsupportedLanguage).toBe("de")
        expect(viewAttempt(start("multi"), today).unsupportedLanguage).toBe("multi")
        expect(viewAttempt(start("en"), today).unsupportedLanguage).toBeNull()
        expect(viewAttempt(createAttempt(), today).unsupportedLanguage).toBeNull()
    })
})

describe("capturing", () => {
    it("blocks Create while starting, listening and finishing", () => {
        let attempt = typeAtEnd(createAttempt(), "Send it")
        expect(viewAttempt(attempt, today).canCreate).toBe(true)

        attempt = startCapture(attempt) ?? attempt
        expect(viewAttempt(attempt, today)).toMatchObject({ captureState: "starting", blockers: ["capturing"] })

        attempt = markCaptureListening(attempt, "en")
        expect(viewAttempt(attempt, today)).toMatchObject({ captureState: "listening", blockers: ["capturing"] })

        attempt = stopCapture(attempt)
        expect(viewAttempt(attempt, today)).toMatchObject({ captureState: "finishing", blockers: ["finishing"] })
        expect(createFromAttempt(attempt, today)).toBeNull()

        attempt = settleCapture(attempt)
        expect(viewAttempt(attempt, today)).toMatchObject({ captureState: "none", canCreate: true })
    })

    it("applies a late final result before settling", () => {
        let attempt = stopCapture(partial(listen(createAttempt()), 0, "Send it hi"))
        attempt = settleCapture(final(attempt, 0, "Send it high priority"))

        expect(readFields(attempt)).toMatchObject({ title: "Send it", priority: 1 })
        expect(viewAttempt(attempt, today).canCreate).toBe(true)
    })

    it("refuses a second capture until the first has settled", () => {
        const finishing = stopCapture(listen(createAttempt()))

        expect(startCapture(finishing)).toBeNull()
        expect(startCapture(settleCapture(finishing))).not.toBeNull()
    })

    it("refuses typing in the description until the capture has settled", () => {
        const listening = final(listen(createAttempt()), 0, "Send it")

        expect(typeDescription(listening, "Other")).toBe(listening)
        const finishing = stopCapture(listening)
        expect(typeDescription(finishing, "Other")).toBe(finishing)
        expect(typeDescription(settle(listening), "Send it now").text).toBe("Send it now")
    })

    it("appends a second capture and reads the whole description", () => {
        let attempt = typeAtEnd(createAttempt(), "Send the proposal")
        attempt = settle(final(listen(attempt), 0, "to Bob high"))
        attempt = settle(final(listen(attempt), 0, "priority"))

        expect(attempt.text).toBe("Send the proposal to Bob high priority")
        expect(readFields(attempt)).toMatchObject({ title: "Send the proposal to Bob", priority: 1 })
    })

    it("leaves the attempt as it was when a capture ends without words", () => {
        const before = typeAtEnd(createAttempt(), "Send it, high priority")
        const after = settle(listen(before))

        expect(after.text).toBe(before.text)
        expect(viewAttempt(after, today)).toMatchObject({ canCreate: true, uncertainties: [] })
    })
})

describe("creating and cancelling", () => {
    it("requires a title that is not blank", () => {
        expect(createFromAttempt(typeAtEnd(createAttempt(), "due tomorrow"), today)).toBeNull()

        const blanked = editField(typeAtEnd(createAttempt(), "Send it"), "title", "   ")
        expect(viewAttempt(blanked, today).blockers).toEqual(["blank_title"])
    })

    it("returns the inspected values once, then nothing", () => {
        const attempt = typeAtEnd(createAttempt(), " Send it , due tomorrow, priority 2, assigned to Bob")
        const created = createFromAttempt(attempt, today)

        expect(created?.fields).toEqual({ title: "Send it", dueDate: "2026-10-13", priority: 2, userId: "2" })
        expect(created && createFromAttempt(created.attempt, today)).toBeNull()
    })

    it("ignores everything that happens to a closed attempt", () => {
        const closed = closeAttempt(final(listen(typeAtEnd(createAttempt(), "Send it")), 0, "high priority"))

        expect(final(closed, 1, "low priority")).toBe(closed)
        expect(settleCapture(closed)).toBe(closed)
        expect(typeDescription(closed, "Other")).toBe(closed)
        expect(editField(closed, "priority", 4)).toBe(closed)
        expect(acceptUncertainty(closed, "key")).toBe(closed)
        expect(startCapture(closed)).toBeNull()
        expect(createFromAttempt(closed, today)).toBeNull()
        expect(viewAttempt(closed, today).canCreate).toBe(false)
    })
})
