import { memoryAdapter } from "better-auth/adapters/memory"
import { makeSignature } from "better-auth/crypto"
import { describe, expect, it } from "vitest"
import {
    createAccountAuth,
    createMemoryRateLimitStorage,
    DISABLED_PATHS,
    isEnabledAuthPath,
} from "./accountAuth.ts"
import type { AccountConfig } from "./accountConfig.ts"

const BASE_URL = "http://localhost:5173"
const SECRET = "test-secret-that-is-long-enough-for-better-auth"

const localConfig: AccountConfig = {
    deployment: "local",
    databaseUrl: "postgres://unused",
    secret: SECRET,
    google: { clientId: "client-id", clientSecret: "client-secret" },
    baseUrl: BASE_URL,
}

type Rows = Record<string, Record<string, unknown>[]>

/** A Better Auth instance with the app's options, keeping its rows in memory. */
const createTestAuth = () => {
    const rows: Rows = { auth_user: [], auth_session: [], auth_account: [], auth_verification: [] }
    const auth = createAccountAuth(localConfig, memoryAdapter(rows))

    return { auth, rows }
}

/** Creates a user with a session, as a completed Google sign-in would. */
const signInTestUser = async (auth: ReturnType<typeof createTestAuth>["auth"]) => {
    const context = await auth.$context
    // The same call a completed Google sign-in makes for a new user.
    const { user } = await context.internalAdapter.createOAuthUser(
        {
            name: "Ada Lovelace",
            email: "ada@example.com",
            emailVerified: true,
            image: "https://example.com/photo.jpg",
        },
        {
            providerId: "google",
            accountId: "google-sub-1",
            accessToken: "access-token",
            refreshToken: "refresh-token",
            idToken: "id-token",
            accessTokenExpiresAt: new Date(),
            refreshTokenExpiresAt: new Date(),
            scope: "openid,email,profile",
        },
    )

    const session = await context.internalAdapter.createSession(user.id)
    const signature = await makeSignature(session.token, context.secret)
    const cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${session.token}.${signature}`)}`

    return { user, cookie }
}

const authRequest = (path: string, init: RequestInit = {}): Request =>
    new Request(`${BASE_URL}/api/auth${path}`, {
        ...init,
        headers: { Origin: BASE_URL, ...init.headers },
    })

describe("isEnabledAuthPath", () => {
    it("allows the endpoints that sign-in uses", () => {
        for (const path of [
            "/api/auth/sign-in/social",
            "/api/auth/callback/google",
            "/api/auth/callback/google/oauth-proxy",
            "/api/auth/get-session",
            "/api/auth/sign-out",
        ]) {
            expect(isEnabledAuthPath(path)).toBe(true)
        }
    })

    it("refuses every other path, including disabled and parameterised ones", () => {
        for (const path of [
            ...DISABLED_PATHS.map((path) => `/api/auth${path}`),
            "/api/auth/reset-password/some-token",
            "/api/auth/callback/github",
            "/api/auth",
            "/api/auth/",
            "/api/authsign-out",
            "/sign-out",
        ]) {
            expect(isEnabledAuthPath(path)).toBe(false)
        }
    })
})

describe("createAccountAuth", () => {
    it("saves no photo, tokens, scope, IP address or user agent", async () => {
        const { auth, rows } = createTestAuth()
        const context = await auth.$context
        const { user } = await signInTestUser(auth)

        await context.internalAdapter.createSession(user.id, false, {
            ipAddress: "203.0.113.7",
            userAgent: "Test browser",
        })

        expect(rows.auth_user).toEqual([
            expect.objectContaining({ name: "Ada Lovelace", email: "ada@example.com", image: null }),
        ])
        expect(rows.auth_account).toEqual([
            expect.objectContaining({
                account_id: "google-sub-1",
                provider_id: "google",
                access_token: null,
                refresh_token: null,
                id_token: null,
                access_token_expires_at: null,
                refresh_token_expires_at: null,
                scope: null,
            }),
        ])
        expect(rows.auth_session).toHaveLength(2)

        for (const session of rows.auth_session) {
            expect(session).toEqual(expect.objectContaining({ ip_address: null, user_agent: null }))
        }
    })

    it("keeps the photo empty when a user is updated", async () => {
        const { auth, rows } = createTestAuth()
        const context = await auth.$context
        const { user } = await signInTestUser(auth)

        await context.internalAdapter.updateUser(user.id, { image: "https://example.com/new.jpg" })

        expect(rows.auth_user[0]).toEqual(expect.objectContaining({ image: null }))
    })

    it("refuses the old session cookie once signed out", async () => {
        const { auth } = createTestAuth()
        const { cookie } = await signInTestUser(auth)

        const before = await auth.handler(authRequest("/get-session", { headers: { cookie } }))
        expect(await before.json()).toEqual(
            expect.objectContaining({ user: expect.objectContaining({ name: "Ada Lovelace" }) }),
        )

        const signOut = await auth.handler(authRequest("/sign-out", { method: "POST", headers: { cookie } }))
        expect(signOut.status).toBe(200)

        const after = await auth.handler(authRequest("/get-session", { headers: { cookie } }))
        expect(await after.json()).toBeNull()
    })

    it("refuses the endpoint that would let the browser change the stored name", async () => {
        const { auth, rows } = createTestAuth()
        const { cookie } = await signInTestUser(auth)

        const response = await auth.handler(
            authRequest("/update-user", {
                method: "POST",
                headers: { cookie, "Content-Type": "application/json" },
                body: JSON.stringify({ name: "Someone else" }),
            }),
        )

        expect(response.status).toBe(404)
        expect(rows.auth_user[0]).toEqual(expect.objectContaining({ name: "Ada Lovelace" }))
    })
})

describe("createMemoryRateLimitStorage", () => {
    it("allows up to the limit in a window, then refuses until the window ends", async () => {
        let time = 0
        const storage = createMemoryRateLimitStorage(() => time)
        const rule = { window: 10, max: 2 }

        expect(await storage.consume("key", rule)).toEqual({ allowed: true, retryAfter: null })
        expect(await storage.consume("key", rule)).toEqual({ allowed: true, retryAfter: null })
        time = 4000
        expect(await storage.consume("key", rule)).toEqual({ allowed: false, retryAfter: 6 })
        expect(await storage.consume("other", rule)).toEqual({ allowed: true, retryAfter: null })
        time = 10_000
        expect(await storage.consume("key", rule)).toEqual({ allowed: true, retryAfter: null })
    })
})
