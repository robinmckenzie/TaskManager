import { readFileSync } from "node:fs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import transcriptFunction from "../api/dictation/transcript.ts"
import { DICTATION_TRANSCRIPT_MAX_LENGTH, DICTATION_TRANSCRIPT_PATH } from "../shared/dictationApi.ts"
import { createActivityStore } from "./dictationActivityStore.ts"
import type { RunInTransaction } from "./dictationActivityStore.ts"
import { createDictationFetchHandler, handleHostedDictationRequest } from "./dictationFunction.ts"
import {
    createTranscriptStore,
    createTranscriptStoreFromEnvironment,
    handleDictationTranscriptRequest,
    TRANSCRIPT_DAILY_ROW_LIMIT,
} from "./dictationTranscripts.ts"
import type { DictationTranscriptLogEntry, DictationTranscriptRecord } from "./dictationTranscripts.ts"

const sessionId = "3f2b8c1e-5a47-4d2a-9b6e-0c1d2e3f4a5b"
const spokenText = "Fix the confidential login bug."
const now = new Date("2026-10-09T10:00:00.000Z")
const validQuery = `?user=Dad&session=${sessionId}`

const transcriptRequest = (query: string, body: string | null = spokenText, init: RequestInit = {}): Request =>
    new Request(`https://taskmanager.example${DICTATION_TRANSCRIPT_PATH}${query}`, {
        method: "POST",
        body,
        ...init,
    })

/** Sends a request to the transcript handler and collects what it saved and logged. */
const send = async (request: Request) => {
    const saved: DictationTranscriptRecord[] = []
    const logged: DictationTranscriptLogEntry[] = []
    const status = await handleDictationTranscriptRequest(request, new URL(request.url), {
        save: async (record) => void saved.push(record),
        write: (entry) => logged.push(entry),
        getNow: () => now,
    })

    return { status, saved, logged }
}

const getConfig = (): never => {
    throw new Error("transcripts must not need the dictation configuration")
}

describe("handleDictationTranscriptRequest", () => {
    it("saves the session's text with its label, session and a server timestamp", async () => {
        expect(await send(transcriptRequest(validQuery))).toEqual({
            status: 204,
            saved: [{
                sessionId,
                user: "Dad",
                text: spokenText,
                timestamp: "2026-10-09T10:00:00.000Z",
            }],
            logged: [{
                type: "dictation_transcript",
                user: "Dad",
                session: sessionId,
                characters: spokenText.length,
                timestamp: "2026-10-09T10:00:00.000Z",
            }],
        })
    })

    it("never puts the text in its log line", async () => {
        const { logged } = await send(transcriptRequest(validQuery))

        expect(Object.keys(logged[0]).sort()).toEqual([
            "characters", "session", "timestamp", "type", "user",
        ])
        expect(JSON.stringify(logged)).not.toContain("confidential")
    })

    it("saves text of the greatest allowed length", async () => {
        const longest = "a".repeat(DICTATION_TRANSCRIPT_MAX_LENGTH)
        const { status, saved } = await send(transcriptRequest(validQuery, longest))

        expect(status).toBe(204)
        expect(saved[0].text).toHaveLength(DICTATION_TRANSCRIPT_MAX_LENGTH)
    })

    it.each([
        ["text that is too long", transcriptRequest(validQuery, "a".repeat(DICTATION_TRANSCRIPT_MAX_LENGTH + 1)), 413],
        ["a body declared as far too large", transcriptRequest(validQuery, "short", { headers: { "content-length": "999999" } }), 413],
        ["no text", transcriptRequest(validQuery, null), 400],
        ["only spaces", transcriptRequest(validQuery, "   "), 400],
        ["an invalid label", transcriptRequest(`?user=two+words&session=${sessionId}`), 400],
        ["a missing label", transcriptRequest(`?session=${sessionId}`), 400],
        ["a session that is not an identifier", transcriptRequest("?user=Dad&session=my+session"), 400],
        ["a missing session", transcriptRequest("?user=Dad"), 400],
        ["a numbered fragment from an earlier version of the app", transcriptRequest(`${validQuery}&sequence=1`), 400],
    ])("rejects %s, saving and logging nothing", async (_description, request, expectedStatus) => {
        expect(await send(request)).toEqual({ status: expectedStatus, saved: [], logged: [] })
    })

    it("rejects an oversized body sent without a declared length, however much of it is padding", async () => {
        const padding = new TextEncoder().encode(" ".repeat(64 * 1024))
        let chunksRead = 0
        const body = new ReadableStream<Uint8Array>({
            pull: (controller) => {
                chunksRead += 1

                if (chunksRead > 20) {
                    controller.enqueue(new TextEncoder().encode("short text"))
                    controller.close()
                } else {
                    controller.enqueue(padding)
                }
            },
        })
        const request = new Request(`https://taskmanager.example${DICTATION_TRANSCRIPT_PATH}${validQuery}`, {
            method: "POST",
            body,
            duplex: "half",
        } as RequestInit)

        expect(request.headers.has("content-length")).toBe(false)
        expect(await send(request)).toEqual({ status: 413, saved: [], logged: [] })
        // Reading stopped at the limit instead of taking in the whole body.
        expect(chunksRead).toBeLessThan(5)
    })

    it("accepts text padded with spaces when the whole body is within the limit", async () => {
        const { status, saved } = await send(transcriptRequest(validQuery, `   ${spokenText}   `))

        expect(status).toBe(204)
        expect(saved[0].text).toBe(spokenText)
    })

    it("reads text split across several chunks, including a character split between two", async () => {
        const bytes = new TextEncoder().encode("café ouvert")
        const body = new ReadableStream<Uint8Array>({
            start: (controller) => {
                controller.enqueue(bytes.slice(0, 4))
                controller.enqueue(bytes.slice(4))
                controller.close()
            },
        })
        const request = new Request(`https://taskmanager.example${DICTATION_TRANSCRIPT_PATH}${validQuery}`, {
            method: "POST",
            body,
            duplex: "half",
        } as RequestInit)

        expect((await send(request)).saved[0].text).toBe("café ouvert")
    })

    it("rejects other methods, saving and logging nothing", async () => {
        const request = new Request(`https://taskmanager.example${DICTATION_TRANSCRIPT_PATH}${validQuery}`)

        expect(await send(request)).toEqual({ status: 405, saved: [], logged: [] })
    })

    it("leaves other paths alone without reading their body", async () => {
        const request = new Request(`https://taskmanager.example/api/dictation/activity${validQuery}`, {
            method: "POST",
            body: spokenText,
        })

        expect(await send(request)).toEqual({ status: undefined, saved: [], logged: [] })
        expect(request.bodyUsed).toBe(false)
    })
})

describe("transcripts and the server log", () => {
    let log: ReturnType<typeof vi.spyOn>
    let error: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
        log = vi.spyOn(console, "log").mockImplementation(() => undefined)
        error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    const loggedText = (): string => JSON.stringify([...log.mock.calls, ...error.mock.calls])

    it("does not write the text to the console when it is saved", async () => {
        const saved: DictationTranscriptRecord[] = []
        const handler = createDictationFetchHandler(getConfig, async () => "temporary-jwt", {
            getTranscriptStore: () => async (record) => void saved.push(record),
        })

        const response = await handler(transcriptRequest(validQuery))

        expect(response.status).toBe(204)
        expect(await response.text()).toBe("")
        expect(saved[0].text).toBe(spokenText)
        expect(log).toHaveBeenCalledTimes(1)
        expect(loggedText()).not.toContain("confidential")
    })

    it("does not write the text to the console when saving fails, and still answers normally", async () => {
        const handler = createDictationFetchHandler(getConfig, async () => "temporary-jwt", {
            getTranscriptStore: () => async (record) => {
                throw Object.assign(new Error(`could not insert "${record.text}"`), { code: "23514" })
            },
        })

        const response = await handler(transcriptRequest(validQuery))

        expect(response.status).toBe(204)
        expect(error).toHaveBeenCalledTimes(1)
        expect(error.mock.calls[0][0]).toBe('{"type":"dictation_activity_store_failed","code":"23514"}')
        expect(loggedText()).not.toContain("confidential")
    })

    it("stores nothing, and does not fail, when no database is configured", async () => {
        const handler = createDictationFetchHandler(getConfig, async () => "temporary-jwt", {
            getTranscriptStore: () => createTranscriptStoreFromEnvironment({}),
        })

        const response = await handler(transcriptRequest(validQuery))

        expect(response.status).toBe(204)
        expect(loggedText()).not.toContain("confidential")
    })

    it("does not touch the activity store or create a token", async () => {
        const storeActivity = vi.fn(async () => undefined)
        const createToken = vi.fn(async () => "temporary-jwt")
        const handler = createDictationFetchHandler(getConfig, createToken, {
            getStore: () => storeActivity,
            getTranscriptStore: () => async () => undefined,
        })

        await handler(transcriptRequest(validQuery))

        expect(storeActivity).not.toHaveBeenCalled()
        expect(createToken).not.toHaveBeenCalled()
    })

    it("is served by its own Vercel function entry point", () => {
        expect(transcriptFunction.fetch).toBe(handleHostedDictationRequest)
    })
})

describe("createTranscriptStore", () => {
    const record: DictationTranscriptRecord = {
        sessionId,
        user: "Dad",
        text: spokenText,
        timestamp: "2026-10-09T10:00:00.000Z",
    }

    const createFakeDatabase = () => {
        const transactions: { sql: string; values: unknown[] }[][] = []
        const runInTransaction: RunInTransaction = async (statements) => {
            transactions.push(statements.map(({ strings, values }) => ({
                sql: strings.join("?").replace(/\s+/g, " ").trim(),
                values,
            })))
        }

        // The insert is the last statement of each transaction.
        return { transactions, runInTransaction, queries: { get 0() { return transactions[0].at(-1)! }, get length() { return transactions.length } } }
    }

    it("inserts the transcript with its session, label and time as parameters", async () => {
        const { queries, runInTransaction } = createFakeDatabase()

        await createTranscriptStore(runInTransaction)(record)

        expect(queries).toHaveLength(1)
        expect(queries[0].sql).toMatch(
            /^insert into dictation_session_transcripts \(session_id, user_label, transcript, occurred_at\)/,
        )
        expect(queries[0].values).toEqual([
            sessionId,
            "Dad",
            spokenText,
            "2026-10-09T10:00:00.000Z",
            TRANSCRIPT_DAILY_ROW_LIMIT,
        ])
        expect(queries[0].sql).not.toContain("confidential")
    })

    it("leaves a session's stored transcript alone when it is sent again", async () => {
        const { queries, runInTransaction } = createFakeDatabase()

        await createTranscriptStore(runInTransaction)(record)

        expect(queries[0].sql).toContain("on conflict (session_id) do nothing")
    })

    it("skips the insert once the daily limit of stored rows is reached, and never creates the table", async () => {
        const { queries, runInTransaction } = createFakeDatabase()

        await createTranscriptStore(runInTransaction)(record)

        expect(queries[0].sql).toContain("where ( select count(*) from dictation_session_transcripts")
        expect(queries[0].sql).not.toMatch(/create table/i)
    })

    it("takes its own row limit lock before inserting, in the same transaction", async () => {
        const transcripts = createFakeDatabase()
        const activity = createFakeDatabase()

        await createTranscriptStore(transcripts.runInTransaction)(record)
        await createActivityStore(activity.runInTransaction)({
            type: "dictation_activity",
            event: "dictation_started",
            user: "Dad",
            timestamp: record.timestamp,
        })

        expect(transcripts.transactions).toHaveLength(1)
        expect(transcripts.transactions[0]).toHaveLength(2)
        expect(transcripts.transactions[0][0].sql).toBe("select pg_advisory_xact_lock(?::bigint)")
        // Saving a transcript does not wait behind saving activity, or the reverse.
        expect(transcripts.transactions[0][0].values).not.toEqual(activity.transactions[0][0].values)
    })

    it.each([{}, { DATABASE_URL: "" }, { DATABASE_URL: "  " }])(
        "makes no store and no connection without a database address (%o)",
        (env) => {
            const connect = vi.fn()

            expect(createTranscriptStoreFromEnvironment(env, connect)).toBeUndefined()
            expect(connect).not.toHaveBeenCalled()
        },
    )
})

describe("dictationTranscripts.sql", () => {
    const schema = readFileSync(new URL("./dictationTranscripts.sql", import.meta.url), "utf8")

    const statements = schema.replace(/^--.*$/gm, "")

    it("only adds the session transcripts table, and can be run again safely", () => {
        expect(statements).toContain("create table if not exists dictation_session_transcripts (")
        expect(statements).toContain("create index if not exists")
        expect(statements.match(/create table/g)).toHaveLength(1)
    })

    it("changes and removes nothing that already exists, including earlier fragment rows", () => {
        expect(statements).not.toMatch(/\b(drop|alter|delete|truncate|update|insert)\b/i)
        expect(statements).not.toMatch(/dictation_transcripts\b|dictation_activity\b/)
    })

    it("limits a transcript to the same length as the app, and keeps one row per session", () => {
        expect(statements).toContain(`char_length(transcript) between 1 and ${DICTATION_TRANSCRIPT_MAX_LENGTH}`)
        expect(statements).toContain("session_id uuid primary key")
    })

    it("allows for a full session of fast speech", () => {
        // About 200 words a minute, at about six characters a word with its space.
        expect(DICTATION_TRANSCRIPT_MAX_LENGTH).toBeGreaterThanOrEqual(200 * 6 * 2)
    })
})
