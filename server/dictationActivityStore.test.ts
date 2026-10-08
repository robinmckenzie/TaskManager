import { readFileSync } from "node:fs"
import { afterEach, describe, expect, it, vi } from "vitest"
import { DICTATION_ACTIVITY_EVENTS, DICTATION_ACTIVITY_PATH } from "../shared/dictationApi.ts"
import type { DictationActivityRecord } from "./dictationActivity.ts"
import {
    ACTIVITY_DAILY_ROW_LIMIT,
    ACTIVITY_STORE_TIMEOUT_MS,
    createActivityStore,
    createActivityStoreFromEnvironment,
    storeActivitySafely,
} from "./dictationActivityStore.ts"
import type { RunActivityQuery } from "./dictationActivityStore.ts"
import { createDictationFetchHandler } from "./dictationFunction.ts"

const record: DictationActivityRecord = {
    type: "dictation_activity",
    event: "dictation_transcript_received",
    user: "Dad",
    timestamp: "2026-10-08T15:30:00.000Z",
}

/** A query function that records the SQL text and values it was given. */
const createFakeQuery = () => {
    const queries: { sql: string; values: unknown[] }[] = []
    const runQuery: RunActivityQuery = async (strings, ...values) => {
        queries.push({ sql: strings.join("?").replace(/\s+/g, " ").trim(), values })
    }

    return { queries, runQuery }
}

const activityRequest = (query: string): Request =>
    new Request(`https://taskmanager.example${DICTATION_ACTIVITY_PATH}${query}`, { method: "POST" })

const getConfig = (): never => {
    throw new Error("activity must not need the dictation configuration")
}

describe("createActivityStore", () => {
    it("inserts only the event, the testing label and the timestamp", async () => {
        const { queries, runQuery } = createFakeQuery()

        await createActivityStore(runQuery)(record)

        expect(queries).toHaveLength(1)
        expect(queries[0].sql).toMatch(/^insert into dictation_activity \(event, user_label, occurred_at\)/)
        expect(queries[0].values).toEqual([
            "dictation_transcript_received",
            "Dad",
            "2026-10-08T15:30:00.000Z",
            ACTIVITY_DAILY_ROW_LIMIT,
        ])
    })

    it("passes values as parameters, never as part of the SQL text", async () => {
        const { queries, runQuery } = createFakeQuery()

        await createActivityStore(runQuery)(record)

        expect(queries[0].sql).not.toContain("Dad")
        expect(queries[0].sql).not.toContain("dictation_transcript_received")
    })

    it("skips the insert once the daily limit of stored rows is reached", async () => {
        const { queries, runQuery } = createFakeQuery()

        await createActivityStore(runQuery)(record)

        expect(queries[0].sql).toContain("where ( select count(*) from dictation_activity")
        expect(queries[0].sql).toContain("interval '1 day' ) < ?")
    })

    it("does not create or check the table when saving", async () => {
        const { queries, runQuery } = createFakeQuery()

        await createActivityStore(runQuery)(record)

        expect(queries[0].sql).not.toMatch(/create table|information_schema|pg_tables/i)
    })
})

describe("createActivityStoreFromEnvironment", () => {
    it.each([{}, { DATABASE_URL: "" }, { DATABASE_URL: "   " }])(
        "makes no store and no connection without a database address (%o)",
        (env) => {
            const connect = vi.fn()

            expect(createActivityStoreFromEnvironment(env, connect)).toBeUndefined()
            expect(connect).not.toHaveBeenCalled()
        },
    )

    it("uses DATABASE_URL when it is set", async () => {
        const { queries, runQuery } = createFakeQuery()
        const connect = vi.fn(() => runQuery)
        const store = createActivityStoreFromEnvironment({ DATABASE_URL: "postgres://example" }, connect)

        await store?.(record)

        expect(connect).toHaveBeenCalledWith("postgres://example")
        expect(queries).toHaveLength(1)
    })
})

describe("storeActivitySafely", () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    it("saves the record", async () => {
        const store = vi.fn(async () => undefined)
        const reportFailure = vi.fn()

        await storeActivitySafely(store, record, reportFailure)

        expect(store).toHaveBeenCalledWith(record)
        expect(reportFailure).not.toHaveBeenCalled()
    })

    it("reports a failure by its database code and never by its message", async () => {
        const reportFailure = vi.fn()
        const store = async (): Promise<void> => {
            throw Object.assign(
                new Error("password authentication failed for postgres://owner:s3cret@host/db"),
                { code: "28P01" },
            )
        }

        await expect(storeActivitySafely(store, record, reportFailure)).resolves.toBeUndefined()

        expect(reportFailure).toHaveBeenCalledWith("28P01")
    })

    it.each([
        ["no code", new Error("fetch failed")],
        ["a code that is not a database code", Object.assign(new Error("x"), { code: "postgres://secret" })],
        ["a thrown string", "connection string postgres://owner:s3cret@host/db"],
    ])("reports a failure with %s without any detail", async (_description, thrown) => {
        const reportFailure = vi.fn()

        await storeActivitySafely(async () => {
            throw thrown
        }, record, reportFailure)

        expect(reportFailure).toHaveBeenCalledWith(undefined)
    })

    it("logs a fixed line for a failure, with no connection details", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => undefined)

        try {
            await storeActivitySafely(async () => {
                throw Object.assign(new Error("relation missing at postgres://owner:s3cret@host/db"), { code: "42P01" })
            }, record)

            expect(error).toHaveBeenCalledTimes(1)
            expect(error.mock.calls[0][0]).toBe('{"type":"dictation_activity_store_failed","code":"42P01"}')
        } finally {
            error.mockRestore()
        }
    })

    it("gives up on a database that does not answer", async () => {
        vi.useFakeTimers()
        const reportFailure = vi.fn()
        const saving = storeActivitySafely(() => new Promise(() => undefined), record, reportFailure)

        await vi.advanceTimersByTimeAsync(ACTIVITY_STORE_TIMEOUT_MS)
        await saving

        expect(reportFailure).toHaveBeenCalledWith(undefined)
    })
})

describe("hosted activity endpoint with a store", () => {
    it.each(DICTATION_ACTIVITY_EVENTS)("logs and stores %s", async (event) => {
        const written: DictationActivityRecord[] = []
        const stored: DictationActivityRecord[] = []
        const handler = createDictationFetchHandler(getConfig, async () => "temporary-jwt", {
            write: (entry) => written.push(entry),
            getStore: () => async (entry) => void stored.push(entry),
        })

        const response = await handler(activityRequest(`?event=${event}&user=Robin`))

        expect(response.status).toBe(204)
        expect(stored).toHaveLength(1)
        expect(stored[0]).toMatchObject({ event, user: "Robin" })
        expect(Object.keys(stored[0]).sort()).toEqual(["event", "timestamp", "type", "user"])
        expect(stored).toEqual(written)
    })

    it("still logs and answers normally when the database fails", async () => {
        const written: DictationActivityRecord[] = []
        const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
        const handler = createDictationFetchHandler(getConfig, async () => "temporary-jwt", {
            write: (entry) => written.push(entry),
            getStore: () => async () => {
                throw new Error("database unreachable")
            },
        })

        try {
            const response = await handler(activityRequest("?event=dictation_started&user=PUBLIC"))

            expect(response.status).toBe(204)
            expect(await response.text()).toBe("")
            expect(written).toHaveLength(1)
            expect(JSON.stringify(error.mock.calls)).not.toContain("database unreachable")
        } finally {
            error.mockRestore()
        }
    })

    it("only logs when no database is configured", async () => {
        const written: DictationActivityRecord[] = []
        const handler = createDictationFetchHandler(getConfig, async () => "temporary-jwt", {
            write: (entry) => written.push(entry),
            getStore: () => createActivityStoreFromEnvironment({}),
        })

        const response = await handler(activityRequest("?event=dictation_completed&user=PUBLIC"))

        expect(response.status).toBe(204)
        expect(written).toHaveLength(1)
    })

    it("stores nothing for an invalid event or label", async () => {
        const store = vi.fn(async () => undefined)
        const handler = createDictationFetchHandler(getConfig, async () => "temporary-jwt", {
            write: () => undefined,
            getStore: () => store,
        })

        expect((await handler(activityRequest("?event=nonsense&user=Robin"))).status).toBe(400)
        expect((await handler(activityRequest("?event=dictation_started&user=two+words"))).status).toBe(400)
        expect(store).not.toHaveBeenCalled()
    })
})

describe("dictationActivity.sql", () => {
    const schema = readFileSync(new URL("./dictationActivity.sql", import.meta.url), "utf8")

    it("allows exactly the events the app reports", () => {
        for (const event of DICTATION_ACTIVITY_EVENTS) {
            expect(schema).toContain(`'${event}'`)
        }

        expect(schema.match(/'dictation_[a-z_]+'/g)).toHaveLength(DICTATION_ACTIVITY_EVENTS.length)
    })

    it("holds only the event, the testing label and the time, and can be run again safely", () => {
        const tableStart = "create table if not exists dictation_activity ("
        const table = schema.slice(schema.indexOf(tableStart), schema.indexOf("\n);"))

        expect(schema).toContain(tableStart)
        expect(table.match(/^ {4}([a-z_]+) /gm)?.map((column) => column.trim())).toEqual([
            "id",
            "event",
            "user_label",
            "occurred_at",
        ])
    })
})
