import { Pool } from "@neondatabase/serverless"
import { ACCOUNT_PROFILE_PATH, ACCOUNT_STATUS_PATH } from "../shared/accountApi.ts"
import type { AccountErrorResponse, AccountStatusResponse } from "../shared/accountApi.ts"
import { createAccountAuth, isEnabledAuthPath } from "./accountAuth.ts"
import { readAccountConfig } from "./accountConfig.ts"
import type { AccountConfig } from "./accountConfig.ts"
import { ACCOUNT_RESPONSE_HEADERS, createProfileStore, handleAccountProfileRequest } from "./accountProfile.ts"
import type { ProfileStore, ReadSessionUserId } from "./accountProfile.ts"
import { readErrorCode } from "./dictationActivityStore.ts"

/*
 * Runs sign-in and the profile endpoint for one request at a time, with
 * web-standard requests and responses. The hosted functions in api/ and the
 * Vite plugin used in development both go through createAccountFetchHandler.
 */

/** What one request needs: Better Auth, the profile store, and a way to let go of both. */
export interface AccountRuntime {
    handleAuthRequest: (request: Request) => Promise<Response>
    readSessionUserId: ReadSessionUserId
    profiles: ProfileStore
    /** Closes the database connections. Called once the response is ready. */
    close: () => Promise<void>
}

/**
 * Opens a runtime backed by a Neon pool. A serverless function may be frozen
 * between requests, so the pool is made for one request and closed after it.
 * Nothing connects until the first query.
 */
export const openNeonAccountRuntime = (config: AccountConfig): AccountRuntime => {
    const pool = new Pool({ connectionString: config.databaseUrl })
    const auth = createAccountAuth(config, pool)

    return {
        handleAuthRequest: (request) => auth.handler(request),
        readSessionUserId: async (headers) => (await auth.api.getSession({ headers }))?.user.id,
        profiles: createProfileStore(pool),
        close: () => pool.end(),
    }
}

const json = (status: number, body: AccountStatusResponse | AccountErrorResponse): Response =>
    new Response(JSON.stringify(body), { status, headers: ACCOUNT_RESPONSE_HEADERS })

const reportAuthFailure = (code: string | undefined): void => {
    console.error(JSON.stringify({ type: "account_auth_failed", code }))
}

/**
 * Creates a request handler for the account routes. `openRuntime` returns
 * undefined when sign-in is not configured. Requests for other paths get a
 * 404, as do Better Auth endpoints the app does not use.
 */
export const createAccountFetchHandler = (
    openRuntime: () => AccountRuntime | undefined,
    isConfigured: () => boolean,
    reportFailure: (code: string | undefined) => void = reportAuthFailure,
) => async (request: Request): Promise<Response> => {
    const { pathname } = new URL(request.url)

    if (pathname === ACCOUNT_STATUS_PATH) {
        return request.method === "GET"
            ? json(200, { configured: isConfigured() })
            : json(405, { error: "method_not_allowed" })
    }

    const isProfile = pathname === ACCOUNT_PROFILE_PATH

    if (!isProfile && !isEnabledAuthPath(pathname)) {
        return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } })
    }

    const runtime = openRuntime()

    if (!runtime) {
        return json(503, { error: "unavailable" })
    }

    try {
        return isProfile
            ? await handleAccountProfileRequest(request, {
                  readSessionUserId: runtime.readSessionUserId,
                  store: runtime.profiles,
              })
            : await runtime.handleAuthRequest(request)
    } catch (error) {
        reportFailure(readErrorCode(error))
        return json(503, { error: "unavailable" })
    } finally {
        await runtime.close().catch(() => undefined)
    }
}

/** Creates the handler for a set of environment variables, read once. */
export const createAccountFetchHandlerFromEnvironment = (env: Record<string, string | undefined>) => {
    const config = readAccountConfig(env)

    return createAccountFetchHandler(
        () => (config ? openNeonAccountRuntime(config) : undefined),
        () => config !== undefined,
    )
}

let hostedHandler: ((request: Request) => Promise<Response>) | undefined

/** Handles account requests in the hosted deployment. */
export const handleHostedAccountRequest = (request: Request): Promise<Response> =>
    // Read once per function instance, on its first request.
    (hostedHandler ??= createAccountFetchHandlerFromEnvironment(process.env))(request)
