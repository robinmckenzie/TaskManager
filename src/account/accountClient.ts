import {
    ACCOUNT_PROFILE_PATH,
    ACCOUNT_STATUS_PATH,
    AUTH_BASE_PATH,
} from "../../shared/accountApi"
import type { AccountProfileResponse, AccountStatusResponse } from "../../shared/accountApi"

/*
 * Talks to the account endpoints. Every request gives up after
 * REQUEST_TIMEOUT_MS, so a server or database that does not answer leaves
 * sign-in reported as unavailable instead of waiting for ever.
 */

export const REQUEST_TIMEOUT_MS = 8000

type Fetch = typeof fetch

/** Who is signed in, as far as this page knows. */
export type AccountSession =
    | { kind: "unavailable" }
    | { kind: "signed_out" }
    | { kind: "signed_in"; name: string; email: string }

/** Why a profile request failed. */
export type ProfileFailure = "signed_out" | "invalid" | "unavailable"

export class ProfileError extends Error {
    readonly failure: ProfileFailure

    constructor(failure: ProfileFailure) {
        super(failure)
        this.failure = failure
    }
}

const request = (fetchFn: Fetch, path: string, init: RequestInit = {}): Promise<Response> =>
    fetchFn(path, { credentials: "same-origin", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), ...init })

const postJson = (fetchFn: Fetch, path: string, body: unknown, method = "POST"): Promise<Response> =>
    request(fetchFn, path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    })

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null

/** Finds out whether sign-in works here and, if so, who is signed in. */
export const loadAccountSession = async (fetchFn: Fetch = fetch): Promise<AccountSession> => {
    try {
        const status = await request(fetchFn, ACCOUNT_STATUS_PATH)
        const statusBody: unknown = status.ok ? await status.json() : undefined

        if ((statusBody as Partial<AccountStatusResponse> | undefined)?.configured !== true) {
            return { kind: "unavailable" }
        }

        const session = await request(fetchFn, `${AUTH_BASE_PATH}/get-session`)

        if (!session.ok) {
            return { kind: "unavailable" }
        }

        const body: unknown = await session.json()

        if (body === null) {
            return { kind: "signed_out" }
        }

        const user = isRecord(body) ? body.user : undefined

        return isRecord(user) && typeof user.name === "string" && typeof user.email === "string"
            ? { kind: "signed_in", name: user.name, email: user.email }
            : { kind: "unavailable" }
    } catch {
        return { kind: "unavailable" }
    }
}

const readProfileResponse = async (response: Response): Promise<string | null> => {
    if (response.status === 401) {
        throw new ProfileError("signed_out")
    }

    if (response.status === 400) {
        throw new ProfileError("invalid")
    }

    const body: unknown = response.ok ? await response.json() : undefined
    const name = isRecord(body) ? (body as Partial<AccountProfileResponse>).preferredName : undefined

    if (name === null || typeof name === "string") {
        return name
    }

    throw new ProfileError("unavailable")
}

const withProfileErrors = async (work: () => Promise<string | null>): Promise<string | null> => {
    try {
        return await work()
    } catch (error) {
        throw error instanceof ProfileError ? error : new ProfileError("unavailable")
    }
}

/** Reads the signed-in account's preferred name. */
export const loadPreferredName = (fetchFn: Fetch = fetch): Promise<string | null> =>
    withProfileErrors(async () => readProfileResponse(await request(fetchFn, ACCOUNT_PROFILE_PATH)))

/** Saves the preferred name, or clears it with null, and returns what was saved. */
export const savePreferredName = (preferredName: string | null, fetchFn: Fetch = fetch): Promise<string | null> =>
    withProfileErrors(async () =>
        readProfileResponse(await postJson(fetchFn, ACCOUNT_PROFILE_PATH, { preferredName }, "PUT")),
    )

/**
 * Asks for Google's sign-in address. Better Auth returns there, or with
 * `?error=` to the same address after a failure.
 */
export const requestSignInAddress = async (returnAddress: string, fetchFn: Fetch = fetch): Promise<string> => {
    const response = await postJson(fetchFn, `${AUTH_BASE_PATH}/sign-in/social`, {
        provider: "google",
        callbackURL: returnAddress,
        errorCallbackURL: returnAddress,
        disableRedirect: true,
    })
    const body: unknown = response.ok ? await response.json() : undefined
    const url = isRecord(body) ? body.url : undefined

    if (typeof url !== "string") {
        throw new Error("Sign-in could not start.")
    }

    return url
}

/** Ends this browser's session. */
export const signOut = async (fetchFn: Fetch = fetch): Promise<void> => {
    const response = await postJson(fetchFn, `${AUTH_BASE_PATH}/sign-out`, {})

    if (!response.ok) {
        throw new Error("Sign-out failed.")
    }
}
