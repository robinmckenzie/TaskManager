import {
    DICTATION_ACTIVITY_EVENTS,
    DICTATION_ACTIVITY_MODES,
    DICTATION_ACTIVITY_PATH,
} from "../shared/dictationApi.ts"
import type { DictationActivityEvent, DictationActivityMode } from "../shared/dictationApi.ts"

/** One line in the server log for a dictation activity event. */
export interface DictationActivityRecord {
    type: "dictation_activity"
    event: DictationActivityEvent
    /** DEV means the browser was marked as its owner's. PUBLIC means only that it was not. */
    mode: DictationActivityMode
    timestamp: string
}

export type WriteActivityRecord = (record: DictationActivityRecord) => void

const writeToServerLog: WriteActivityRecord = (record) => {
    console.log(JSON.stringify(record))
}

const isOneOf = <T extends string>(values: readonly T[], value: string | null): value is T =>
    value !== null && (values as readonly string[]).includes(value)

/**
 * Records a dictation activity event in the server log and returns the HTTP
 * status to answer with, or undefined for any other path. Only an event name
 * and mode from the fixed lists are ever logged, so nothing else a caller
 * sends, such as transcript text, can reach the log.
 */
export const handleDictationActivityRequest = (
    method: string | undefined,
    url: URL,
    write: WriteActivityRecord = writeToServerLog,
    getNow: () => Date = () => new Date(),
): number | undefined => {
    if (url.pathname !== DICTATION_ACTIVITY_PATH) {
        return undefined
    }

    if (method !== "POST") {
        return 405
    }

    const event = url.searchParams.get("event")
    const mode = url.searchParams.get("mode")

    if (!isOneOf(DICTATION_ACTIVITY_EVENTS, event) || !isOneOf(DICTATION_ACTIVITY_MODES, mode)) {
        return 400
    }

    write({ type: "dictation_activity", event, mode, timestamp: getNow().toISOString() })
    return 204
}
