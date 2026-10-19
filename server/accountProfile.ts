import { normalisePreferredName } from "../shared/accountApi.ts"
import type {
    AccountApiErrorCode,
    AccountErrorResponse,
    AccountProfileResponse,
} from "../shared/accountApi.ts"
import { readErrorCode } from "./dictationActivityStore.ts"

/*
 * The profile endpoint: the signed-in account's preferred name. Whose profile
 * is read or changed comes only from the session cookie, never from anything
 * else in the request, and only the preferred name is ever read from a body.
 */

/** How long a profile request may wait for the session or the database. */
export const ACCOUNT_STORE_TIMEOUT_MS = 5000

export const ACCOUNT_RESPONSE_HEADERS = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
} as const

/** Reads and changes preferred names, keyed by account. */
export interface ProfileStore {
    read: (userId: string) => Promise<string | null>
    /** Saves the name, or removes it when null. */
    write: (userId: string, preferredName: string | null) => Promise<void>
}

/** Finds the signed-in account from a request's headers, or undefined when there is none. */
export type ReadSessionUserId = (headers: Headers) => Promise<string | undefined>

/** The part of a Postgres pool that the store uses. */
export interface Queryable {
    query: (text: string, values: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>
}

/** Creates the store over the user_profile table from accountTables.sql. */
export const createProfileStore = (database: Queryable): ProfileStore => ({
    read: async (userId) => {
        const { rows } = await database.query(
            "select preferred_name from user_profile where user_id = $1",
            [userId],
        )
        const name = rows[0]?.preferred_name

        return typeof name === "string" ? name : null
    },
    write: async (userId, preferredName) => {
        if (preferredName === null) {
            await database.query("delete from user_profile where user_id = $1", [userId])
            return
        }

        await database.query(
            `insert into user_profile (user_id, preferred_name) values ($1, $2)
             on conflict (user_id) do update
             set preferred_name = excluded.preferred_name, updated_at = now()`,
            [userId, preferredName],
        )
    },
})

const json = (status: number, body: AccountProfileResponse | AccountErrorResponse): Response =>
    new Response(JSON.stringify(body), { status, headers: ACCOUNT_RESPONSE_HEADERS })

const fail = (status: number, error: AccountApiErrorCode): Response => json(status, { error })

/** Rejects if the work takes longer than the timeout. */
export const withTimeout = async <Result>(work: Promise<Result>, timeoutMs: number): Promise<Result> => {
    let timer: ReturnType<typeof setTimeout> | undefined

    try {
        return await Promise.race([
            work,
            new Promise<never>((_resolve, reject) => {
                timer = setTimeout(() => reject(new Error("timed out")), timeoutMs)
            }),
        ])
    } finally {
        clearTimeout(timer)
    }
}

const reportProfileFailure = (code: string | undefined): void => {
    console.error(JSON.stringify({ type: "account_profile_failed", code }))
}

/** Reads the new preferred name from a PUT body, or undefined if the body is not valid. */
const readProfileUpdate = async (request: Request): Promise<{ preferredName: string | null } | undefined> => {
    let body: unknown

    try {
        body = await request.json()
    } catch {
        return undefined
    }

    if (typeof body !== "object" || body === null || !("preferredName" in body)) {
        return undefined
    }

    if (body.preferredName === null) {
        return { preferredName: null }
    }

    const preferredName = normalisePreferredName(body.preferredName)

    return preferredName === undefined ? undefined : { preferredName }
}

export interface ProfileRequestDependencies {
    readSessionUserId: ReadSessionUserId
    store: ProfileStore
    timeoutMs?: number
    reportFailure?: (code: string | undefined) => void
}

/** Handles GET and PUT ACCOUNT_PROFILE_PATH. */
export const handleAccountProfileRequest = async (
    request: Request,
    {
        readSessionUserId,
        store,
        timeoutMs = ACCOUNT_STORE_TIMEOUT_MS,
        reportFailure = reportProfileFailure,
    }: ProfileRequestDependencies,
): Promise<Response> => {
    if (request.method !== "GET" && request.method !== "PUT") {
        return fail(405, "method_not_allowed")
    }

    // A cross-site page cannot send a JSON body without the browser first
    // asking permission, which this endpoint never gives.
    if (request.method === "PUT" && !request.headers.get("Content-Type")?.startsWith("application/json")) {
        return fail(400, "invalid_preferred_name")
    }

    try {
        const userId = await withTimeout(readSessionUserId(request.headers), timeoutMs)

        if (userId === undefined) {
            return fail(401, "not_signed_in")
        }

        if (request.method === "GET") {
            return json(200, { preferredName: await withTimeout(store.read(userId), timeoutMs) })
        }

        const update = await readProfileUpdate(request)

        if (!update) {
            return fail(400, "invalid_preferred_name")
        }

        await withTimeout(store.write(userId, update.preferredName), timeoutMs)

        return json(200, update)
    } catch (error) {
        reportFailure(readErrorCode(error))
        return fail(503, "unavailable")
    }
}
