import { format } from "date-fns"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { describeQuickDueDate, getQuickDueDates } from "./quickDueDates"

const datesFor = (today: Date): string[] => getQuickDueDates(today).map((quick) => quick.dueDate)

describe("getQuickDueDates", () => {
    it("names Today, Tomorrow and In a week, in that order", () => {
        expect(getQuickDueDates(new Date(2026, 10, 8, 12)).map((quick) => quick.name))
            .toEqual(["Today", "Tomorrow", "In a week"])
    })

    it("gives today, tomorrow and 7 days on", () => {
        expect(datesFor(new Date(2026, 10, 8, 12))).toEqual(["2026-11-08", "2026-11-09", "2026-11-15"])
    })

    it.each([
        [0, 0, 0],
        [0, 0, 1],
        [12, 0, 0],
        [23, 30, 0],
        [23, 59, 59],
    ])("gives the same local dates at %i:%i:%i", (hours, minutes, seconds) => {
        expect(datesFor(new Date(2026, 10, 8, hours, minutes, seconds)))
            .toEqual(["2026-11-08", "2026-11-09", "2026-11-15"])
    })

    it("crosses month ends", () => {
        expect(datesFor(new Date(2026, 9, 31, 23, 30))).toEqual(["2026-10-31", "2026-11-01", "2026-11-07"])
        expect(datesFor(new Date(2026, 10, 30, 9))).toEqual(["2026-11-30", "2026-12-01", "2026-12-07"])
    })

    it("crosses a year end", () => {
        expect(datesFor(new Date(2026, 11, 31, 23, 59))).toEqual(["2026-12-31", "2027-01-01", "2027-01-07"])
        expect(datesFor(new Date(2026, 11, 25, 8))).toEqual(["2026-12-25", "2026-12-26", "2027-01-01"])
    })

    it("handles 28 and 29 February in non-leap and leap years", () => {
        expect(datesFor(new Date(2027, 1, 28, 12))).toEqual(["2027-02-28", "2027-03-01", "2027-03-07"])
        expect(datesFor(new Date(2028, 1, 28, 12))).toEqual(["2028-02-28", "2028-02-29", "2028-03-06"])
        expect(datesFor(new Date(2028, 1, 29, 23, 45))).toEqual(["2028-02-29", "2028-03-01", "2028-03-07"])
        expect(datesFor(new Date(2027, 1, 21, 12))).toEqual(["2027-02-21", "2027-02-22", "2027-02-28"])
        expect(datesFor(new Date(2028, 1, 22, 12))).toEqual(["2028-02-22", "2028-02-23", "2028-02-29"])
    })

    describe.each([
        { zone: "Europe/London", springDay: [2, 29], autumnDay: [9, 25] },
        { zone: "America/New_York", springDay: [2, 8], autumnDay: [10, 1] },
    ])("across daylight-saving changes in $zone", ({ zone, springDay, autumnDay }) => {
        beforeAll(() => {
            vi.stubEnv("TZ", zone)
        })

        afterAll(() => {
            vi.unstubAllEnvs()
        })

        const hoursInDay = ([month, day]: number[]): number =>
            (new Date(2026, month, day! + 1).getTime() - new Date(2026, month, day).getTime()) / 3_600_000

        it("really has a 23 hour and a 25 hour day on the change days", () => {
            expect(hoursInDay(springDay)).toBe(23)
            expect(hoursInDay(autumnDay)).toBe(25)
        })

        it("adds whole calendar days from the evening before and the morning of the spring change", () => {
            const [month, day] = springDay as [number, number]

            expect(datesFor(new Date(2026, month, day - 1, 23, 30)).slice(0, 2))
                .toEqual([format(new Date(2026, month, day - 1), "yyyy-MM-dd"), format(new Date(2026, month, day), "yyyy-MM-dd")])
            expect(datesFor(new Date(2026, month, day, 0, 30))).toEqual([
                format(new Date(2026, month, day), "yyyy-MM-dd"),
                format(new Date(2026, month, day + 1), "yyyy-MM-dd"),
                format(new Date(2026, month, day + 7), "yyyy-MM-dd"),
            ])
            expect(datesFor(new Date(2026, month, day - 1, 23, 30))[2])
                .toBe(format(new Date(2026, month, day + 6), "yyyy-MM-dd"))
        })

        it("adds whole calendar days from the evening before and the morning of the autumn change", () => {
            const [month, day] = autumnDay as [number, number]

            expect(datesFor(new Date(2026, month, day - 1, 23, 30))).toEqual([
                format(new Date(2026, month, day - 1), "yyyy-MM-dd"),
                format(new Date(2026, month, day), "yyyy-MM-dd"),
                format(new Date(2026, month, day + 6), "yyyy-MM-dd"),
            ])
            expect(datesFor(new Date(2026, month, day, 0, 30))).toEqual([
                format(new Date(2026, month, day), "yyyy-MM-dd"),
                format(new Date(2026, month, day + 1), "yyyy-MM-dd"),
                format(new Date(2026, month, day + 7), "yyyy-MM-dd"),
            ])
            expect(datesFor(new Date(2026, month, day, 23, 30))[1])
                .toBe(format(new Date(2026, month, day + 1), "yyyy-MM-dd"))
        })
    })

    it("does not change the date it is given", () => {
        const today = new Date(2026, 10, 8, 23, 30)
        const before = today.getTime()

        getQuickDueDates(today)

        expect(today.getTime()).toBe(before)
    })
})

describe("describeQuickDueDate", () => {
    it("names the button, the date it sets and the task", () => {
        expect(
            describeQuickDueDate({ name: "Tomorrow", dueDate: "2026-11-09" }, "Prepare sprint demo"),
        ).toBe("Tomorrow, 9 Nov, for Prepare sprint demo")
    })

    it("names a blank task by its position", () => {
        expect(
            describeQuickDueDate({ name: "Today", dueDate: "2026-11-08" }, "untitled task 2"),
        ).toBe("Today, 8 Nov, for untitled task 2")
    })
})
