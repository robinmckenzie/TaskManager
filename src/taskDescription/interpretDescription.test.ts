import { describe, expect, it } from "vitest"
import { interpretDescription } from "./interpretDescription"
import type { DescriptionInterpretation } from "./interpretDescription"

// Monday 12 October 2026.
const referenceDay = new Date(2026, 9, 12, 15, 30)
const assignees = [
    { id: "4", name: "Aaron" },
    { id: "1", name: "Alice" },
    { id: "2", name: "Bob" },
    { id: "3", name: "Charlie" },
    { id: "5", name: "Mary Ann" },
]

const interpret = (text: string): DescriptionInterpretation =>
    interpretDescription(text, referenceDay, assignees)

/** The title and the final value of each field that the description sets. */
const read = (text: string) => {
    const { title, instructions, uncertainties } = interpret(text)
    const fields = Object.fromEntries(instructions.map(({ field, value }) => [field, value]))

    return { title, ...fields, uncertain: uncertainties.map((uncertainty) => uncertainty.wording) }
}

describe("interpretDescription", () => {
    describe("storyboards", () => {
        it("reads a title, due date, priority and assignee", () => {
            expect(read("Send the proposal, due tomorrow, high priority, assigned to Aaron")).toEqual({
                title: "Send the proposal",
                dueDate: "2026-10-13",
                priority: 1,
                userId: "4",
                uncertain: [],
            })
        })

        it("reads priority high as high priority", () => {
            expect(read("Send the proposal, priority high")).toMatchObject({
                title: "Send the proposal",
                priority: 1,
            })
        })

        it("lets a later priority replace an earlier one without a correction word", () => {
            expect(read("Send the proposal, high priority, low priority")).toMatchObject({
                title: "Send the proposal",
                priority: 5,
            })
        })

        it("drops the connector no before a correction", () => {
            expect(read("Send the proposal, high priority, no, low priority")).toMatchObject({
                title: "Send the proposal",
                priority: 5,
            })
        })

        it("reads change priority to low without adding its words to the title", () => {
            expect(read("Send the proposal, change priority to low")).toMatchObject({
                title: "Send the proposal",
                priority: 5,
            })
        })

        it("keeps a phrase that ordinary words follow in the title", () => {
            expect(read("Review the high priority policy")).toEqual({
                title: "Review the high priority policy",
                uncertain: [],
            })
        })

        it("lets a later due date replace an earlier one", () => {
            expect(read("Send the proposal, due tomorrow ... no, due Friday")).toMatchObject({
                title: "Send the proposal",
                dueDate: "2026-10-16",
            })
        })
    })

    describe("priority", () => {
        it.each([
            ["high priority", 1],
            ["medium priority", 3],
            ["low priority", 5],
            ["priority high", 1],
            ["priority medium", 3],
            ["priority low", 5],
            ["priority 1", 1],
            ["priority 2", 2],
            ["priority three", 3],
            ["priority four", 4],
            ["Priority 5.", 5],
            ["change the priority to 2", 2],
            ["change priority to medium", 3],
        ])("reads %s", (phrase, priority) => {
            expect(read(`Call the bank ${phrase}`)).toMatchObject({ title: "Call the bank", priority })
        })

        it("flags a priority outside 1 to 5 and leaves the words in the title", () => {
            const { title, instructions, uncertainties } = interpret("Call the bank, priority six")

            expect(title).toBe("Call the bank, priority six")
            expect(instructions).toEqual([])
            expect(uncertainties).toMatchObject([
                { field: "priority", wording: "priority six", reason: "not_understood", isInTitle: true },
            ])
        })
    })

    describe("due dates", () => {
        it.each([
            ["due today", "2026-10-12"],
            ["due tomorrow", "2026-10-13"],
            ["due Friday", "2026-10-16"],
            ["due on Friday", "2026-10-16"],
            // A weekday is its next occurrence after the reference day.
            ["due Monday", "2026-10-19"],
            ["due Sunday", "2026-10-18"],
            ["due 15 October", "2026-10-15"],
            ["due 15th of October", "2026-10-15"],
            ["due the 15th of October", "2026-10-15"],
            ["due October 15", "2026-10-15"],
            ["due October 15th, 2026", "2026-10-15"],
            ["due 12 October", "2026-10-12"],
            // Without a year, the next such date on or after the reference day.
            ["due 1 October", "2027-10-01"],
            ["due 29 February", "2028-02-29"],
            ["due 3 March 2027", "2027-03-03"],
            ["change due date to Friday", "2026-10-16"],
            ["change the due date to 15 October", "2026-10-15"],
        ])("reads %s", (phrase, dueDate) => {
            expect(read(`Call the bank, ${phrase}`)).toMatchObject({ title: "Call the bank", dueDate })
        })

        it.each(["no due date", "clear due date", "clear the due date"])("reads %s as no due date", (phrase) => {
            expect(read(`Call the bank due tomorrow, ${phrase}`)).toMatchObject({
                title: "Call the bank",
                dueDate: "",
            })
        })

        it("does not read no due date as the connector no before a due date", () => {
            const { instructions } = interpret("Call the bank, high priority, no due date")

            expect(instructions.map((instruction) => instruction.wording)).toEqual(["high priority", "no due date"])
        })

        it("needs the word due before a date", () => {
            expect(read("Call Bob tomorrow")).toEqual({ title: "Call Bob tomorrow", uncertain: [] })
        })

        it.each([
            ["due next Friday", "not_understood"],
            ["due 15/10", "not_understood"],
            ["due Blursday", "not_understood"],
            ["due 31 February", "date_does_not_exist"],
            ["due 31 February 2027", "date_does_not_exist"],
            ["due 1 October 2020", "date_in_past"],
        ])("flags %s and sets no date", (phrase, reason) => {
            const { instructions, uncertainties } = interpret(`Call the bank, ${phrase}`)

            expect(instructions).toEqual([])
            expect(uncertainties).toMatchObject([{ field: "dueDate", wording: phrase, reason }])
        })

        it("marks dates that depend on the reference day", () => {
            const isRelative = (text: string): boolean | undefined => interpret(text).instructions[0]?.isRelative

            expect(isRelative("Call due tomorrow")).toBe(true)
            expect(isRelative("Call due Friday")).toBe(true)
            expect(isRelative("Call due 15 October")).toBe(true)
            expect(isRelative("Call due 15 October 2026")).toBe(false)
            expect(isRelative("Call no due date")).toBe(false)
        })
    })

    describe("assignees", () => {
        it.each([
            ["assigned to Aaron", "4"],
            ["assign to bob", "2"],
            ["Assigned to Mary Ann.", "5"],
            ["change assignee to Charlie", "3"],
            ["change the assignee to Alice", "1"],
        ])("reads %s", (phrase, userId) => {
            expect(read(`Call the bank, ${phrase}`)).toMatchObject({ title: "Call the bank", userId })
        })

        it("flags a name that no assignee has", () => {
            const { title, instructions, uncertainties } = interpret("Call the bank, assigned to Morgan")

            expect(title).toBe("Call the bank, assigned to Morgan")
            expect(instructions).toEqual([])
            expect(uncertainties).toMatchObject([
                { field: "userId", wording: "assigned to Morgan", isInTitle: true },
            ])
        })

        it("does not assign from a name alone", () => {
            expect(read("Call Bob")).toEqual({ title: "Call Bob", uncertain: [] })
        })
    })

    describe("title and instructions", () => {
        it("reads a description with no instructions as the title", () => {
            expect(read("  Send the\nproposal.  ")).toEqual({ title: "Send the proposal.", uncertain: [] })
        })

        it("gives a blank title when the description has only instructions", () => {
            expect(read("due tomorrow, high priority")).toMatchObject({ title: "", dueDate: "2026-10-13" })
        })

        it("ignores capitals and punctuation", () => {
            expect(read("Send it. DUE: Tomorrow; High-Priority!")).toMatchObject({
                title: "Send it",
                dueDate: "2026-10-13",
                priority: 1,
            })
        })

        it("reads actually as a connector", () => {
            expect(read("Send it due tomorrow actually due Friday")).toMatchObject({
                title: "Send it",
                dueDate: "2026-10-16",
            })
        })

        it("keeps no and actually in a title", () => {
            expect(read("Say no to Bob")).toMatchObject({ title: "Say no to Bob" })
            expect(read("Actually finish it, high priority")).toMatchObject({
                title: "Actually finish it",
                priority: 1,
            })
        })

        it("returns earlier instructions to the title when ordinary words follow them", () => {
            expect(read("Send it, high priority, and tell Bob")).toEqual({
                title: "Send it, high priority, and tell Bob",
                uncertain: [],
            })
        })

        it("reports each instruction's place in the text", () => {
            const text = "Send it, high priority, due tomorrow"

            expect(interpret(text).instructions.map(({ start, end }) => text.slice(start, end))).toEqual([
                "high priority",
                "due tomorrow",
            ])
        })
    })

    describe("uncertainty", () => {
        it("flags a title that ends in a cue and one word", () => {
            const { title, uncertainties } = interpret("Prepare due diligence")

            expect(title).toBe("Prepare due diligence")
            expect(uncertainties).toMatchObject([{ field: "dueDate", wording: "due diligence", isInTitle: true }])
        })

        it("does not flag a cue that ordinary words follow", () => {
            expect(read("The report is due and we should finish it").uncertain).toEqual([])
            expect(read("Fix the priority queue in the scheduler").uncertain).toEqual([])
        })

        it("does not flag a cue on its own at the end", () => {
            expect(read("Send the proposal due")).toEqual({ title: "Send the proposal due", uncertain: [] })
        })

        it("keeps a failed phrase before the instructions in the title", () => {
            expect(read("Send it due Blursday, high priority")).toEqual({
                title: "Send it due Blursday",
                priority: 1,
                uncertain: ["due Blursday"],
            })
        })

        it("keeps a failed phrase after an instruction out of the title", () => {
            const { title, instructions, uncertainties } = interpret("Send it, high priority, due Blursday")

            expect(title).toBe("Send it")
            expect(instructions).toMatchObject([{ field: "priority", value: 1 }])
            expect(uncertainties).toMatchObject([{ wording: "due Blursday", isInTitle: false }])
        })

        it("gives the same wording the same key, and a repeat of it another", () => {
            const first = interpret("Send it due Blursday").uncertainties[0].key
            const repeated = interpret("Send it DUE blursday, due Blursday").uncertainties.map(({ key }) => key)

            expect(repeated).toEqual([first, `${first}#2`])
            expect(interpret("Send it due Blursdays").uncertainties[0].key).not.toBe(first)
        })
    })
})
