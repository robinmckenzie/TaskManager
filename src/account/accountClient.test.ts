import { describe, expect, it, vi } from "vitest"
import {
    loadAccountSession,
    loadPreferredName,
    ProfileError,
    requestSignInAddress,
    savePreferredName,
} from "./accountClient"

const jsonResponse = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

/** A fetch that answers each path from a table, and fails for anything else. */
const fakeFetch = (routes: Record<string, () => Promise<Response>>) =>
    vi.fn(async (input: RequestInfo | URL) => {
        const route = routes[String(input)]

        if (!route) {
            throw new TypeError("Failed to fetch")
        }

        return route()
    }) as unknown as typeof fetch

const configured = { "/api/account/status": async () => jsonResponse({ configured: true }) }

describe("loadAccountSession", () => {
    it("reports sign-in as unavailable when it is not configured", async () => {
        const fetchFn = fakeFetch({ "/api/account/status": async () => jsonResponse({ configured: false }) })

        expect(await loadAccountSession(fetchFn)).toEqual({ kind: "unavailable" })
    })

    it("reports signed out when there is no session", async () => {
        const fetchFn = fakeFetch({ ...configured, "/api/auth/get-session": async () => jsonResponse(null) })

        expect(await loadAccountSession(fetchFn)).toEqual({ kind: "signed_out" })
    })

    it("reports who is signed in", async () => {
        const fetchFn = fakeFetch({
            ...configured,
            "/api/auth/get-session": async () =>
                jsonResponse({ user: { id: "u1", name: "Ada", email: "ada@example.com" }, session: {} }),
        })

        expect(await loadAccountSession(fetchFn)).toEqual({ kind: "signed_in", name: "Ada", email: "ada@example.com" })
    })

    it("reports sign-in as unavailable when the server fails, cannot be reached or answers nonsense", async () => {
        const failingRoutes: Record<string, () => Promise<Response>>[] = [
            { "/api/account/status": async () => new Response("", { status: 500 }) },
            {},
            { ...configured, "/api/auth/get-session": async () => jsonResponse({ error: "unavailable" }, 503) },
            { ...configured, "/api/auth/get-session": async () => new Response("not json") },
            { ...configured, "/api/auth/get-session": async () => jsonResponse({ user: "odd" }) },
            { ...configured, "/api/auth/get-session": () => Promise.reject(new DOMException("timed out", "TimeoutError")) },
        ]

        for (const routes of failingRoutes) {
            expect(await loadAccountSession(fakeFetch(routes))).toEqual({ kind: "unavailable" })
        }
    })
})

describe("preferred name", () => {
    it("reads and saves the name", async () => {
        const fetchFn = fakeFetch({ "/api/account/profile": async () => jsonResponse({ preferredName: "Ada" }) })

        expect(await loadPreferredName(fetchFn)).toBe("Ada")
        expect(await savePreferredName("Ada", fetchFn)).toBe("Ada")
        expect(vi.mocked(fetchFn).mock.calls[1][1]).toEqual(
            expect.objectContaining({ method: "PUT", body: JSON.stringify({ preferredName: "Ada" }) }),
        )
    })

    it("tells a refused, invalid and unavailable request apart", async () => {
        const failureFor = async (response: () => Promise<Response>) => {
            try {
                await loadPreferredName(fakeFetch({ "/api/account/profile": response }))
            } catch (error) {
                return error instanceof ProfileError ? error.failure : "other"
            }

            return "none"
        }

        expect(await failureFor(async () => jsonResponse({ error: "not_signed_in" }, 401))).toBe("signed_out")
        expect(await failureFor(async () => jsonResponse({ error: "invalid_preferred_name" }, 400))).toBe("invalid")
        expect(await failureFor(async () => jsonResponse({ error: "unavailable" }, 503))).toBe("unavailable")
        expect(await failureFor(() => Promise.reject(new TypeError("Failed to fetch")))).toBe("unavailable")
    })
})

describe("requestSignInAddress", () => {
    it("asks for Google, returning to the given address after success or failure", async () => {
        const fetchFn = fakeFetch({
            "/api/auth/sign-in/social": async () => jsonResponse({ url: "https://accounts.google.com/o/oauth2", redirect: false }),
        })

        expect(await requestSignInAddress("https://taskmanager.example/?user=Robin", fetchFn)).toBe(
            "https://accounts.google.com/o/oauth2",
        )
        expect(JSON.parse(String(vi.mocked(fetchFn).mock.calls[0][1]?.body))).toEqual({
            provider: "google",
            callbackURL: "https://taskmanager.example/?user=Robin",
            errorCallbackURL: "https://taskmanager.example/?user=Robin",
            disableRedirect: true,
        })
    })

    it("fails when the server does not give an address", async () => {
        const fetchFn = fakeFetch({ "/api/auth/sign-in/social": async () => jsonResponse({ error: "x" }, 503) })

        await expect(requestSignInAddress("/", fetchFn)).rejects.toThrow()
    })
})
