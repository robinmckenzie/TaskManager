import { existsSync, readdirSync, readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"
import authFunction from "../api/auth.ts"
import profileFunction from "../api/account/profile.ts"
import statusFunction from "../api/account/status.ts"
import {
    ACCOUNT_CLOSE_TIMEOUT_MS,
    createAccountFetchHandler,
    createAccountFetchHandlerFromEnvironment,
} from "./accountFunction.ts"
import type { AccountRuntime } from "./accountFunction.ts"

const request = (path: string, init?: RequestInit): Request =>
    new Request(`https://taskmanager.example${path}`, init)

const createRuntime = (overrides: Partial<AccountRuntime> = {}): AccountRuntime & { close: ReturnType<typeof vi.fn> } => ({
    handleAuthRequest: async () => new Response("auth"),
    readSessionUserId: async () => "user-ada",
    profiles: { read: async () => "Ada", write: async () => undefined },
    ...overrides,
    close: vi.fn(async () => undefined),
})

describe("createAccountFetchHandler", () => {
    it("reports whether sign-in is configured", async () => {
        const configured = createAccountFetchHandler(() => createRuntime(), () => true)
        const notConfigured = createAccountFetchHandler(() => undefined, () => false)

        expect(await (await configured(request("/api/account/status"))).json()).toEqual({ configured: true })
        expect(await (await notConfigured(request("/api/account/status"))).json()).toEqual({ configured: false })
        expect((await notConfigured(request("/api/account/status", { method: "POST" }))).status).toBe(405)
    })

    it("passes the enabled Better Auth endpoints on, and closes the runtime afterwards", async () => {
        const runtime = createRuntime()
        const handler = createAccountFetchHandler(() => runtime, () => true)

        const response = await handler(request("/api/auth/get-session"))

        expect(await response.text()).toBe("auth")
        expect(runtime.close).toHaveBeenCalledOnce()
    })

    it("refuses Better Auth endpoints the app does not use without opening a runtime", async () => {
        const openRuntime = vi.fn(() => createRuntime())
        const handler = createAccountFetchHandler(openRuntime, () => true)

        for (const path of ["/api/auth/update-user", "/api/auth/reset-password/token", "/api/auth/sign-in/email"]) {
            expect((await handler(request(path, { method: "POST" }))).status).toBe(404)
        }

        expect(openRuntime).not.toHaveBeenCalled()
    })

    it("serves the profile through the session", async () => {
        const handler = createAccountFetchHandler(() => createRuntime(), () => true)

        expect(await (await handler(request("/api/account/profile"))).json()).toEqual({ preferredName: "Ada" })
    })

    it("reports sign-in and the profile as unavailable when not configured", async () => {
        const handler = createAccountFetchHandler(() => undefined, () => false)

        for (const path of ["/api/auth/get-session", "/api/account/profile"]) {
            const response = await handler(request(path))

            expect(response.status).toBe(503)
            expect(await response.json()).toEqual({ error: "unavailable" })
        }
    })

    it("reports sign-in as unavailable when Better Auth fails, logging only a code", async () => {
        const reportFailure = vi.fn()
        const runtime = createRuntime({
            handleAuthRequest: () =>
                Promise.reject(Object.assign(new Error("postgres://user:password@host refused"), { code: "08001" })),
        })
        const handler = createAccountFetchHandler(() => runtime, () => true, reportFailure)

        const response = await handler(request("/api/auth/get-session"))

        expect(response.status).toBe(503)
        expect(reportFailure).toHaveBeenCalledWith("08001")
        expect(runtime.close).toHaveBeenCalledOnce()
    })

    it("answers without waiting more than the close timeout for connections to close", async () => {
        vi.useFakeTimers()

        try {
            const runtime = createRuntime()
            runtime.close.mockReturnValue(new Promise<void>(() => undefined))
            const handler = createAccountFetchHandler(() => runtime, () => true)

            const pending = handler(request("/api/account/profile"))
            await vi.advanceTimersByTimeAsync(ACCOUNT_CLOSE_TIMEOUT_MS)

            expect(await (await pending).json()).toEqual({ preferredName: "Ada" })
        } finally {
            vi.useRealTimers()
        }
    })

    it("answers 404 for paths outside the account routes", async () => {
        const handler = createAccountFetchHandler(() => createRuntime(), () => true)

        expect((await handler(request("/api/account/other"))).status).toBe(404)
    })
})

describe("createAccountFetchHandlerFromEnvironment", () => {
    it("reports sign-in as not configured without the sign-in variables", async () => {
        const handler = createAccountFetchHandlerFromEnvironment({ DATABASE_URL: "postgres://production" })

        expect(await (await handler(request("/api/account/status"))).json()).toEqual({ configured: false })
        expect((await handler(request("/api/auth/get-session"))).status).toBe(503)
    })
})

describe("hosted functions", () => {
    it("export the account handler", () => {
        expect(typeof authFunction.fetch).toBe("function")
        expect(profileFunction.fetch).toBe(authFunction.fetch)
        expect(statusFunction.fetch).toBe(authFunction.fetch)
    })

    // Configuration only: that Vercel keeps the path and query is checked on a deployment.
    it("are configured to receive every sign-in path through the rewrite", () => {
        const { rewrites } = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"))

        expect(rewrites).toContainEqual({ source: "/api/auth/:path*", destination: "/api/auth" })
        // A file under api/auth/ would take precedence over the rewrite for the paths it matches.
        const authFolder = new URL("../api/auth", import.meta.url)
        expect(existsSync(authFolder) ? readdirSync(authFolder) : []).toEqual([])
    })
})
