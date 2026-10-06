export type DictationErrorKind =
    | "not_configured"
    | "not_authorised"
    | "usage_limit"
    | "service_unavailable"
    | "connection_lost"
    | "microphone_denied"
    | "microphone_missing"
    | "microphone_error"
    | "unsupported"

export type DictationStopReason =
    | "user"
    | "inactivity"
    | "max_duration"
    | "focus"
    | "task_deleted"
    | "error"

export class DictationError extends Error {
    readonly kind: DictationErrorKind

    constructor(kind: DictationErrorKind, options?: ErrorOptions) {
        super(kind, options)
        this.kind = kind
    }
}

const formatSeconds = (seconds: number): string => `${seconds} second${seconds === 1 ? "" : "s"}`

/** Configured timings mentioned in stop messages, in seconds. */
export interface StopMessageTimings {
    inactivityTimeoutSeconds: number
    maxSessionSeconds: number
}

export const describeDictationError = (kind: DictationErrorKind): string => {
    switch (kind) {
        case "not_configured":
            return "Dictation is not configured. See the README to add a Speechmatics API key."
        case "not_authorised":
            return "Speechmatics refused the request. Check the API key, and that the server can reach Speechmatics."
        case "usage_limit":
            return "Dictation stopped because the Speechmatics usage limit was reached."
        case "service_unavailable":
            return "Dictation is unavailable because the speech service could not be reached."
        case "connection_lost":
            return "Dictation stopped because the connection to the speech service was lost."
        case "microphone_denied":
            return "Dictation needs microphone access. Allow the microphone for this site and try again."
        case "microphone_missing":
            return "Dictation could not find a microphone."
        case "microphone_error":
            return "Dictation could not start the microphone."
        case "unsupported":
            return "Dictation is not supported in this browser or on an insecure connection."
    }
}

export const describeDictationStop = (
    reason: Exclude<DictationStopReason, "error">,
    timings?: StopMessageTimings,
): string => {
    switch (reason) {
        case "user":
            return "Dictation stopped."
        case "inactivity":
            return timings
                ? `Dictation stopped after ${formatSeconds(timings.inactivityTimeoutSeconds)} without recognised speech.`
                : "Dictation stopped because no speech was recognised."
        case "max_duration":
            return timings
                ? `Dictation stopped after reaching its ${timings.maxSessionSeconds}-second limit.`
                : "Dictation stopped after reaching its time limit."
        case "focus":
            return "Dictation stopped because focus left the task title."
        case "task_deleted":
            return "Dictation stopped because its task was deleted."
    }
}

/** Maps a Speechmatics realtime error type to a dictation error kind. */
export const getRealtimeErrorKind = (type: string | undefined): DictationErrorKind => {
    switch (type) {
        case "not_authorised":
        case "not_allowed":
            return "not_authorised"
        case "quota_exceeded":
        case "timelimit_exceeded":
            return "usage_limit"
        default:
            return "service_unavailable"
    }
}

/** Maps a microphone start failure to a dictation error kind. */
export const getMicrophoneErrorKind = (error: unknown): DictationErrorKind => {
    const name = typeof error === "object" && error !== null && "name" in error
        ? error.name
        : undefined

    if (name === "NotAllowedError" || name === "SecurityError") {
        return "microphone_denied"
    }

    if (name === "NotFoundError" || name === "OverconstrainedError") {
        return "microphone_missing"
    }

    return "microphone_error"
}
