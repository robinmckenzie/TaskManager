import { betterAuth } from "better-auth"
import type { BetterAuthOptions } from "better-auth"
import { AUTH_BASE_PATH } from "../shared/accountApi.ts"
import type { AccountConfig } from "./accountConfig.ts"

/*
 * Better Auth, set up for Google sign-in only. The tables are the ones in
 * accountTables.sql. Database hooks make sure that nothing beyond Google's
 * account ID, name and email is ever saved: no tokens, photo, IP address or
 * browser user agent.
 */

/**
 * The only Better Auth endpoints served, below AUTH_BASE_PATH. Requests for
 * any other path are refused before they reach Better Auth, which also covers
 * endpoints a later version might add.
 */
const ENABLED_PATHS: readonly string[] = [
    "/sign-in/social",
    "/callback/google",
    "/get-session",
    "/sign-out",
    "/error",
    "/ok",
]

/** Whether a request path is one of the Better Auth endpoints the app uses. */
export const isEnabledAuthPath = (pathname: string): boolean =>
    pathname.startsWith(`${AUTH_BASE_PATH}/`) &&
    ENABLED_PATHS.includes(pathname.slice(AUTH_BASE_PATH.length))

/**
 * Better Auth's own endpoints in version 1.7.7 that the app does not use,
 * disabled in Better Auth as well as by isEnabledAuthPath. `/update-user`
 * matters most: it would let the browser change the stored name and photo.
 * Better Auth matches these exactly, so a path with a parameter cannot be
 * listed; isEnabledAuthPath covers those.
 */
export const DISABLED_PATHS = [
    "/account-info",
    "/change-email",
    "/change-password",
    "/delete-user",
    "/delete-user/callback",
    "/get-access-token",
    "/link-social",
    "/list-accounts",
    "/list-sessions",
    "/refresh-token",
    "/request-password-reset",
    "/reset-password",
    "/revoke-other-sessions",
    "/revoke-session",
    "/revoke-sessions",
    "/send-verification-email",
    "/sign-in/email",
    "/sign-up/email",
    "/unlink-account",
    "/update-session",
    "/update-user",
    "/verify-email",
    "/verify-password",
]

/** Account fields that would hold Google's tokens. They are always saved empty. */
export const EMPTY_ACCOUNT_TOKENS = {
    accessToken: null,
    refreshToken: null,
    idToken: null,
    accessTokenExpiresAt: null,
    refreshTokenExpiresAt: null,
    scope: null,
}

/**
 * Hooks that run before each record is saved. Their `data` is merged over
 * what Better Auth was about to save.
 */
export const accountDatabaseHooks = {
    user: {
        create: { before: async () => ({ data: { image: null } }) },
        update: { before: async () => ({ data: { image: null } }) },
    },
    account: {
        create: { before: async () => ({ data: EMPTY_ACCOUNT_TOKENS }) },
        update: { before: async () => ({ data: EMPTY_ACCOUNT_TOKENS }) },
    },
    session: {
        create: { before: async () => ({ data: { ipAddress: null, userAgent: null } }) },
        update: { before: async () => ({ data: { ipAddress: null, userAgent: null } }) },
    },
} satisfies BetterAuthOptions["databaseHooks"]

/** Better Auth's names for the tables and columns in accountTables.sql. */
const tableNames = {
    user: {
        modelName: "auth_user",
        fields: { emailVerified: "email_verified", createdAt: "created_at", updatedAt: "updated_at" },
    },
    session: {
        modelName: "auth_session",
        fields: {
            expiresAt: "expires_at",
            createdAt: "created_at",
            updatedAt: "updated_at",
            ipAddress: "ip_address",
            userAgent: "user_agent",
            userId: "user_id",
        },
    },
    account: {
        modelName: "auth_account",
        fields: {
            accountId: "account_id",
            providerId: "provider_id",
            userId: "user_id",
            accessToken: "access_token",
            refreshToken: "refresh_token",
            idToken: "id_token",
            accessTokenExpiresAt: "access_token_expires_at",
            refreshTokenExpiresAt: "refresh_token_expires_at",
            createdAt: "created_at",
            updatedAt: "updated_at",
        },
    },
    verification: {
        modelName: "auth_verification",
        fields: { expiresAt: "expires_at", createdAt: "created_at", updatedAt: "updated_at" },
    },
}

type RateLimitStorage = NonNullable<NonNullable<BetterAuthOptions["rateLimit"]>["customStorage"]>

/**
 * Rate limit counts held in this server instance's memory. A function
 * instance serves many requests, but the auth instance is made afresh for
 * each one, so the counts are kept here rather than in Better Auth's own
 * memory store. Each instance counts separately.
 */
export const createMemoryRateLimitStorage = (now: () => number = Date.now): RateLimitStorage => {
    const windows = new Map<string, { startedAt: number; count: number }>()

    return {
        consume: async (key, { window, max }) => {
            const time = now()
            const windowMs = window * 1000
            const current = windows.get(key)

            // Drop expired windows as they are met, so the map cannot grow unbounded.
            for (const [storedKey, stored] of windows) {
                if (time - stored.startedAt >= windowMs) {
                    windows.delete(storedKey)
                }
            }

            if (!current || time - current.startedAt >= windowMs) {
                windows.set(key, { startedAt: time, count: 1 })
                return { allowed: true, retryAfter: null }
            }

            if (current.count >= max) {
                return { allowed: false, retryAfter: Math.ceil((current.startedAt + windowMs - time) / 1000) }
            }

            current.count += 1
            return { allowed: true, retryAfter: null }
        },
    }
}

const rateLimitStorage = createMemoryRateLimitStorage()

/**
 * Logs only the level of Better Auth's own warnings and errors. Their
 * messages and arguments can carry database or provider error details.
 */
export const logAccountAuthMessage = (level: string): void => {
    console.error(JSON.stringify({ type: "account_auth_log", level }))
}

/** What Better Auth reads and writes through: a Postgres pool, or a test adapter. */
export type AccountDatabase = BetterAuthOptions["database"]

/** Builds Better Auth's options. Separate from createAccountAuth so tests can inspect them. */
export const buildAccountAuthOptions = (config: AccountConfig, database: AccountDatabase) =>
    ({
        appName: "TaskManager",
        basePath: AUTH_BASE_PATH,
        baseURL: config.baseUrl,
        secret: config.secret,
        database,
        telemetry: { enabled: false },
        logger: { log: logAccountAuthMessage },
        disabledPaths: DISABLED_PATHS,
        socialProviders: {
            google: {
                clientId: config.google.clientId,
                clientSecret: config.google.clientSecret,
                // Sign-in only through Google's redirect, never by posting an ID token.
                disableIdTokenSignIn: true,
            },
        },
        user: tableNames.user,
        session: {
            ...tableNames.session,
            // Every request checks the session row, so signing out takes effect at once.
            cookieCache: { enabled: false },
        },
        account: {
            ...tableNames.account,
            // Name and email are kept from the first sign-in, and tokens are never refreshed.
            updateAccountOnSignIn: false,
            accountLinking: { enabled: false },
        },
        verification: tableNames.verification,
        databaseHooks: accountDatabaseHooks,
        rateLimit: { enabled: true, customStorage: rateLimitStorage },
        onAPIError: { errorURL: "/" },
    }) satisfies BetterAuthOptions

export const createAccountAuth = (config: AccountConfig, database: AccountDatabase) =>
    betterAuth(buildAccountAuthOptions(config, database))

export type AccountAuth = ReturnType<typeof createAccountAuth>
