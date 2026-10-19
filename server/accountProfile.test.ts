import { describe, expect, it, vi } from "vitest"
import { createProfileStore, handleAccountProfileRequest } from "./accountProfile.ts"
import type { ProfileStore, Queryable, ReadSessionUserId } from "./accountProfile.ts"

const PROFILE_URL = "https://taskmanager.example/api/account/profile"

/** Two signed-in accounts, told apart by their session cookie. */
const sessions: Record<string, string> = { "session=ada": "user-ada", "session=bob": "user-bob" }

const readSessionUserId: ReadSessionUserId = async (headers) => sessions[headers.get("cookie") ?? ""]

const createMemoryStore = (initial: Record<string, string> = {}): ProfileStore & { names: Map<string, string> } => {
    const names = new Map(Object.entries(initial))

    return {
        names,
        read: async (userId) => names.get(userId) ?? null,
        write: async (userId, name) => {
            if (name === null) {
                names.delete(userId)
            } else {
                names.set(userId, name)
            }
        },
    }
}

const get = (cookie?: string, query = ""): Request =>
    new Request(`${PROFILE_URL}${query}`, { headers: cookie ? { cookie } : {} })

const put = (body: unknown, cookie?: string, query = ""): Request =>
    new Request(`${PROFILE_URL}${query}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
        body: JSON.stringify(body),
    })

const handle = (request: Request, store: ProfileStore, reportFailure = vi.fn()) =>
    handleAccountProfileRequest(request, { readSessionUserId, store, timeoutMs: 50, reportFailure })

describe("handleAccountProfileRequest", () => {
    it("returns only the signed-in account's preferred name", async () => {
        const store = createMemoryStore({ "user-ada": "Ada", "user-bob": "Bob" })

        const response = await handle(get("session=ada"), store)

        expect(response.status).toBe(200)
        expect(response.headers.get("Cache-Control")).toBe("no-store")
        expect(await response.json()).toEqual({ preferredName: "Ada" })
    })

    it("returns null when no preferred name is set", async () => {
        expect(await (await handle(get("session=ada"), createMemoryStore())).json()).toEqual({ preferredName: null })
    })

    it("ignores an account named in the address or the body", async () => {
        const store = createMemoryStore({ "user-ada": "Ada", "user-bob": "Bob" })

        const read = await handle(get("session=ada", "?userId=user-bob&user_id=user-bob"), store)
        expect(await read.json()).toEqual({ preferredName: "Ada" })

        const write = await handle(
            put({ preferredName: "Changed", userId: "user-bob", user_id: "user-bob" }, "session=ada", "?userId=user-bob"),
            store,
        )
        expect(write.status).toBe(200)
        expect(store.names.get("user-ada")).toBe("Changed")
        expect(store.names.get("user-bob")).toBe("Bob")
    })

    it("refuses requests without a valid sign-in", async () => {
        const store = createMemoryStore({ "user-ada": "Ada" })

        for (const request of [
            get(),
            get("session=unknown"),
            put({ preferredName: "Intruder" }),
            put({ preferredName: "Intruder" }, "session=unknown"),
        ]) {
            const response = await handle(request, store)

            expect(response.status).toBe(401)
            expect(await response.json()).toEqual({ error: "not_signed_in" })
        }

        expect(store.names).toEqual(new Map([["user-ada", "Ada"]]))
    })

    it("saves a trimmed name and clears it with null", async () => {
        const store = createMemoryStore()

        const saved = await handle(put({ preferredName: "  Ada  " }, "session=ada"), store)
        expect(await saved.json()).toEqual({ preferredName: "Ada" })
        expect(store.names.get("user-ada")).toBe("Ada")

        const cleared = await handle(put({ preferredName: null }, "session=ada"), store)
        expect(await cleared.json()).toEqual({ preferredName: null })
        expect(store.names.has("user-ada")).toBe(false)
    })

    it("refuses a name that is empty, too long or not text, and a body that is not JSON", async () => {
        const store = createMemoryStore({ "user-ada": "Ada" })
        const notJson = new Request(PROFILE_URL, {
            method: "PUT",
            headers: { "Content-Type": "application/json", cookie: "session=ada" },
            body: "{",
        })
        const notMarkedJson = new Request(PROFILE_URL, {
            method: "PUT",
            headers: { "Content-Type": "text/plain", cookie: "session=ada" },
            body: JSON.stringify({ preferredName: "Plain" }),
        })

        for (const request of [
            put({ preferredName: "   " }, "session=ada"),
            put({ preferredName: "x".repeat(51) }, "session=ada"),
            put({ preferredName: 42 }, "session=ada"),
            put({}, "session=ada"),
            notJson,
            notMarkedJson,
        ]) {
            const response = await handle(request, store)

            expect(response.status).toBe(400)
            expect(await response.json()).toEqual({ error: "invalid_preferred_name" })
        }

        expect(store.names.get("user-ada")).toBe("Ada")
    })

    it("accepts a name of exactly 50 characters", async () => {
        const store = createMemoryStore()

        expect((await handle(put({ preferredName: "x".repeat(50) }, "session=ada"), store)).status).toBe(200)
    })

    it("refuses other methods", async () => {
        const response = await handle(new Request(PROFILE_URL, { method: "DELETE" }), createMemoryStore())

        expect(response.status).toBe(405)
    })

    it("reports the profile as unavailable when the store fails, logging only a code", async () => {
        const failure = Object.assign(new Error("connection to postgres://user:password@host failed"), {
            code: "08006",
        })
        const store: ProfileStore = {
            read: () => Promise.reject(failure),
            write: () => Promise.reject(failure),
        }
        const reportFailure = vi.fn()

        for (const request of [get("session=ada"), put({ preferredName: "Ada" }, "session=ada")]) {
            const response = await handle(request, store, reportFailure)

            expect(response.status).toBe(503)
            expect(await response.json()).toEqual({ error: "unavailable" })
        }

        expect(reportFailure.mock.calls).toEqual([["08006"], ["08006"]])
    })

    it("reports the profile as unavailable when the store does not respond", async () => {
        const store: ProfileStore = { read: () => new Promise(() => undefined), write: () => new Promise(() => undefined) }

        expect((await handle(get("session=ada"), store)).status).toBe(503)
        expect((await handle(put({ preferredName: "Ada" }, "session=ada"), store)).status).toBe(503)
    })

    it("reports the profile as unavailable when the session cannot be checked", async () => {
        const response = await handleAccountProfileRequest(get("session=ada"), {
            readSessionUserId: () => Promise.reject(new Error("database down")),
            store: createMemoryStore(),
            reportFailure: vi.fn(),
        })

        expect(response.status).toBe(503)
    })
})

describe("createProfileStore", () => {
    it("reads, saves and clears by account using parameters, never text built from values", async () => {
        const database: Queryable & { calls: [string, unknown[]][] } = {
            calls: [],
            query: async function (text, values) {
                this.calls.push([text, values])
                return { rows: text.startsWith("select") ? [{ preferred_name: "Ada" }] : [] }
            },
        }
        const store = createProfileStore(database)

        expect(await store.read("user-ada")).toBe("Ada")
        await store.write("user-ada", "Ada'; drop table user_profile; --")
        await store.write("user-ada", null)

        expect(database.calls.map(([, values]) => values)).toEqual([
            ["user-ada"],
            ["user-ada", "Ada'; drop table user_profile; --"],
            ["user-ada"],
        ])
        expect(database.calls.some(([text]) => text.includes("drop table"))).toBe(false)
        expect(database.calls[2][0]).toMatch(/^delete from user_profile/)
    })
})
