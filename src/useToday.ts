import { useEffect, useState } from "react"
import { watchForDayChange } from "./today"

/**
 * Returns a date within the current local calendar day, and redraws the
 * component when that day changes while the page is open.
 */
export const useToday = (): Date => {
    const [today, setToday] = useState<Date>(() => new Date())

    useEffect(() => watchForDayChange(setToday), [])

    return today
}
