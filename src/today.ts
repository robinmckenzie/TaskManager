import { addDays, isSameDay, startOfDay } from "date-fns"

/** Returns how long it is until the next local calendar day begins. */
export const getMillisecondsUntilNextDay = (now: Date): number =>
    startOfDay(addDays(now, 1)).getTime() - now.getTime()

/**
 * Calls `onDayChange` with the current time once the local calendar date is no
 * longer the one it was when watching began, and again at each later change.
 *
 * It checks at each local midnight. A timer can be late when the page is in
 * the background or the device has been asleep, so it also checks whenever the
 * page is shown or focused again.
 *
 * Returns a function that stops the watching.
 */
export const watchForDayChange = (onDayChange: (now: Date) => void): (() => void) => {
    let lastSeenDay = new Date()
    let timer: ReturnType<typeof setTimeout> | undefined

    const checkDay = (): void => {
        const now = new Date()

        if (!isSameDay(now, lastSeenDay)) {
            lastSeenDay = now
            onDayChange(now)
        }

        clearTimeout(timer)
        timer = setTimeout(checkDay, getMillisecondsUntilNextDay(now))
    }

    checkDay()
    document.addEventListener("visibilitychange", checkDay)
    window.addEventListener("focus", checkDay)
    window.addEventListener("pageshow", checkDay)

    return (): void => {
        clearTimeout(timer)
        document.removeEventListener("visibilitychange", checkDay)
        window.removeEventListener("focus", checkDay)
        window.removeEventListener("pageshow", checkDay)
    }
}
