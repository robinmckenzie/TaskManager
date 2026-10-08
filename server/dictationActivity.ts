import {
    DICTATION_ACTIVITY_EVENTS,
    DICTATION_ACTIVITY_PATH,
    isDictationActivityUser,
} from "../shared/dictationApi.ts"
import type { DictationActivityEvent } from "../shared/dictationApi.ts"

/** One line in the server log for a dictation activity event. */
export interface DictationActivityRecord {
    type: "dictation_activity"
    event: DictationActivityEvent
    /** A testing label set in the browser, or PUBLIC when none was set. */
    user: string
    timestamp: string
}

export type WriteActivityRecord = (record: DictationActivityRecord) => void

/** Writes a record to the server log as one line of JSON. */
export const writeActivityToServerLog: WriteActivityRecord = (record) => {
    console.log(JSON.stringify(record))
}

const isActivityEvent = (value: string | null): value is DictationActivityEvent =>
    value !== null && (DICTATION_ACTIVITY_EVENTS as readonly string[]).includes(value)

/**
 * Records a dictation activity event in the server log and returns the HTTP
 * status to answer with, or undefined for any other path. Only an event name
 * from the fixed list and a short label of letters, digits, hyphens and
 * underscores are ever logged, so nothing else a caller sends, such as
 * transcript text, can reach the log.
 */
export const handleDictationActivityRequest = (
    method: string | undefined,
    url: URL,
    write: WriteActivityRecord = writeActivityToServerLog,
    getNow: () => Date = () => new Date(),
): number | undefined => {
    if (url.pathname !== DICTATION_ACTIVITY_PATH) {
        return undefined
    }

    if (method !== "POST") {
        return 405
    }

    const event = url.searchParams.get("event")
    const user = url.searchParams.get("user")

    if (!isActivityEvent(event) || !isDictationActivityUser(user)) {
        return 400
    }

    write({ type: "dictation_activity", event, user, timestamp: getNow().toISOString() })
    return 204
}
