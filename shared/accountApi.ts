/**
 * The account API between the server and the browser. Both sides import these
 * definitions, so keep this file free of Node and browser APIs.
 */

/** Where Better Auth's own endpoints are served. */
export const AUTH_BASE_PATH = "/api/auth"
export const ACCOUNT_STATUS_PATH = "/api/account/status"
export const ACCOUNT_PROFILE_PATH = "/api/account/profile"

/** The longest preferred name, in characters. */
export const PREFERRED_NAME_MAX_LENGTH = 50

/** Response to GET ACCOUNT_STATUS_PATH. */
export interface AccountStatusResponse {
    configured: boolean
}

/** Response to GET and PUT ACCOUNT_PROFILE_PATH. */
export interface AccountProfileResponse {
    /** The signed-in account's preferred name, or null when none is set. */
    preferredName: string | null
}

/** Body of PUT ACCOUNT_PROFILE_PATH. Null clears the preferred name. */
export interface AccountProfileUpdate {
    preferredName: string | null
}

export type AccountApiErrorCode =
    | "not_signed_in"
    | "invalid_preferred_name"
    | "method_not_allowed"
    | "unavailable"

export interface AccountErrorResponse {
    error: AccountApiErrorCode
}

/**
 * Reads a preferred name as it will be stored: without surrounding spaces,
 * and 1 to PREFERRED_NAME_MAX_LENGTH characters long. Returns undefined for
 * anything else, including a name that is only spaces.
 */
export const normalisePreferredName = (value: unknown): string | undefined => {
    if (typeof value !== "string") {
        return undefined
    }

    const name = value.trim()

    return name.length > 0 && [...name].length <= PREFERRED_NAME_MAX_LENGTH ? name : undefined
}
