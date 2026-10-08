/**
 * The dictation API between the local server and the browser. Both sides
 * import these definitions, so keep this file free of Node and browser APIs.
 */

export const DICTATION_STATUS_PATH = "/api/dictation/status"
export const DICTATION_TOKEN_PATH = "/api/dictation/token"

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
