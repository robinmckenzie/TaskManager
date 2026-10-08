/**
 * The dictation API between the local server and the browser. Both sides
 * import these definitions, so keep this file free of Node and browser APIs.
 */

export const DICTATION_STATUS_PATH = "/api/dictation/status"
export const DICTATION_TOKEN_PATH = "/api/dictation/token"
export const DICTATION_ACTIVITY_PATH = "/api/dictation/activity"

/** What the browser may report about a dictation session. Never its content. */
export const DICTATION_ACTIVITY_EVENTS = [
    "dictation_started",
    "dictation_transcript_received",
    "dictation_completed",
    "dictation_failed",
] as const
export type DictationActivityEvent = (typeof DICTATION_ACTIVITY_EVENTS)[number]

/** Reported as the user by a browser that has no testing label set. */
export const DICTATION_ACTIVITY_PUBLIC_USER = "PUBLIC"

const ACTIVITY_USER_PATTERN = /^[A-Za-z0-9_-]{1,20}$/

/**
 * Whether a value may be logged as an activity user: a short testing label of
 * letters, digits, hyphens and underscores, which includes PUBLIC.
 */
export const isDictationActivityUser = (value: string | null | undefined): value is string =>
    typeof value === "string" && ACTIVITY_USER_PATTERN.test(value)

/** Timings from dictation.config.toml, in seconds. */
export interface DictationTimings {
    inactivityTimeoutSeconds: number
    maxSessionSeconds: number
    settleTimeoutSeconds: number
}

/** Response to GET DICTATION_STATUS_PATH. */
export interface DictationStatusResponse {
    configured: boolean
}

/** Successful response to POST DICTATION_TOKEN_PATH. */
export interface DictationToken {
    /** Short-lived Speechmatics key. The long-lived API key is never sent. */
    jwt: string
    url: string
    model: string
    language: string
    timings: DictationTimings
}

export type DictationApiErrorCode =
    | "method_not_allowed"
    | "not_configured"
    | "not_authorised"
    | "service_unavailable"

/** Response body when a dictation API request fails. */
export interface DictationErrorResponse {
    error: DictationApiErrorCode
}
