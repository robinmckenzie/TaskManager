import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { describeDueStatus, getDaysUntilDue } from "./dueDates"
import { getMillisecondsUntilNextDay, watchForDayChange } from "./today"

describe("getMillisecondsUntilNextDay", () => {
    it("measures the time left until the next local midnight", () => {
        expect(getMillisecondsUntilNextDay(new Date(2026, 9, 8, 23, 59, 59))).toBe(1000)
        expect(getMillisecondsUntilNextDay(new Date(2026, 9, 8, 0, 0, 0))).toBe(24 * 60 * 60 * 1000)
        expect(getMillisecondsUntilNextDay(new Date(2026, 11, 31, 23, 0, 0))).toBe(60 * 60 * 1000)
    })
})

describe("watchForDayChange", () => {
    let page: EventTarget
    let browserWindow: EventTarget
    let reportedDays: Date[]
    let stopWatching: () => void

    const startWatchingAt = (now: Date): void => {
        vi.setSystemTime(now)
        stopWatching = watchForDayChange((day) => reportedDays.push(day))
    }

    beforeEach(() => {
        vi.useFakeTimers()
        page = new EventTarget()
        browserWindow = new EventTarget()
        vi.stubGlobal("document", page)
        vi.stubGlobal("window", browserWindow)
        reportedDays = []
    })

    afterEach(() => {
        stopWatching()
        vi.unstubAllGlobals()
        vi.useRealTimers()
    })

    it("reports the new day when midnight passes while the page is open", () => {
        startWatchingAt(new Date(2026, 9, 8, 23, 59, 30))

        vi.advanceTimersByTime(29_000)
        expect(reportedDays).toEqual([])

        vi.advanceTimersByTime(1_000)
        expect(reportedDays).toEqual([new Date(2026, 9, 9, 0, 0, 0)])
    })

    it("changes a task due tomorrow to due today at midnight", () => {
        const dueDate = "2026-10-09"
        let today = new Date(2026, 9, 8, 23, 59, 30)
        const describeTask = (): string => describeDueStatus(getDaysUntilDue(dueDate, today), false)

        vi.setSystemTime(today)
        stopWatching = watchForDayChange((day) => {
            today = day
        })
        expect(describeTask()).toBe("1 day remaining")

        vi.advanceTimersByTime(30_000)
        expect(describeTask()).toBe("Due today")
    })

    it("goes on reporting each later day", () => {
        startWatchingAt(new Date(2026, 9, 8, 12))

        vi.advanceTimersByTime(3 * 24 * 60 * 60 * 1000)

        expect(reportedDays).toEqual([
            new Date(2026, 9, 9),
            new Date(2026, 9, 10),
            new Date(2026, 9, 11),
        ])
    })

    it.each([
        { event: "visibilitychange", target: (): EventTarget => page },
        { event: "focus", target: (): EventTarget => browserWindow },
        { event: "pageshow", target: (): EventTarget => browserWindow },
    ])("reports the new day on $event when the midnight timer has not run", ({ event, target }) => {
        startWatchingAt(new Date(2026, 9, 8, 22))

        // The clock moves on without the timer running, as when a device has been asleep.
        vi.setSystemTime(new Date(2026, 9, 9, 7, 15))
        expect(reportedDays).toEqual([])

        target().dispatchEvent(new Event(event))
        expect(reportedDays).toEqual([new Date(2026, 9, 9, 7, 15)])
    })

    it("reports nothing when the page is returned to on the same day", () => {
        startWatchingAt(new Date(2026, 9, 8, 9))

        vi.setSystemTime(new Date(2026, 9, 8, 17))
        page.dispatchEvent(new Event("visibilitychange"))
        browserWindow.dispatchEvent(new Event("focus"))

        expect(reportedDays).toEqual([])
    })

    it("still reports the next midnight after the page is returned to", () => {
        startWatchingAt(new Date(2026, 9, 8, 9))

        vi.setSystemTime(new Date(2026, 9, 8, 23, 59))
        browserWindow.dispatchEvent(new Event("focus"))
        vi.advanceTimersByTime(60_000)

        expect(reportedDays).toEqual([new Date(2026, 9, 9)])
    })

    it("reports nothing after it is stopped", () => {
        startWatchingAt(new Date(2026, 9, 8, 23, 59, 30))
        stopWatching()

        vi.advanceTimersByTime(60_000)
        vi.setSystemTime(new Date(2026, 9, 10, 8))
        page.dispatchEvent(new Event("visibilitychange"))
        browserWindow.dispatchEvent(new Event("focus"))

        expect(reportedDays).toEqual([])
    })
})
