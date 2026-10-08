import {
    DICTATION_TRANSCRIPT_MAX_LENGTH,
    DICTATION_TRANSCRIPT_PATH,
    isDictationActivityUser,
} from "../shared/dictationApi.ts"
import { connectToNeon, lockRowLimit, sql } from "./dictationActivityStore.ts"
import type { RunInTransaction } from "./dictationActivityStore.ts"

/*
 * Keeps the final text that Speechmatics recognised during dictation on the
 * deployed app, so its owner can see what was recognised. The text is saved to
 * the database and nowhere else: it is never written to a log.
 */

/** One final transcript from a dictation session. */
export interface DictationTranscriptRecord {
    /** A random identifier the browser makes for each dictation session. */
    sessionId: string
    /** The position of this final result within its session, from 1. */
    sequence: number
    /** A testing label set in the browser, or PUBLIC when none was set. */
    user: string
    text: string
    timestamp: string
}

/** Saves one transcript record. Rejects if it could not be saved. */
export type StoreTranscriptRecord = (record: DictationTranscriptRecord) => Promise<void>

/** What a transcript log line may contain: everything about a record except its text. */
export interface DictationTranscriptLogEntry {
    type: "dictation_transcript"
    user: string
    session: string
    sequence: number
    characters: number
    timestamp: string
}

export type WriteTranscriptLogEntry = (entry: DictationTranscriptLogEntry) => void

/** The most transcript rows stored in any 24 hours. */
export const TRANSCRIPT_DAILY_ROW_LIMIT = 1000

const TRANSCRIPT_ROW_LIMIT_LOCK = 724_050_002
const MAX_SEQUENCE = 10_000
// A character can take up to four bytes.
const MAX_BODY_BYTES = DICTATION_TRANSCRIPT_MAX_LENGTH * 4
const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const writeEntryToServerLog: WriteTranscriptLogEntry = (entry) => {
    console.log(JSON.stringify(entry))
}

/**
 * Reads a request body as text, stopping as soon as it exceeds the byte limit.
 * Returns undefined for a body that is too large, however it was sent: the
 * limit does not depend on the request declaring its length.
 */
const readBodyWithinLimit = async (request: Request, maxBytes: number): Promise<string | undefined> => {
    if (!request.body) {
        return ""
    }

    const reader = request.body.getReader()
    const chunks: Uint8Array[] = []
    let byteCount = 0

    for (;;) {
        const { done, value } = await reader.read()

        if (done) {
            break
        }

        byteCount += value.byteLength

        if (byteCount > maxBytes) {
            await reader.cancel().catch(() => undefined)
            return undefined
        }

        chunks.push(value)
    }

    const bytes = new Uint8Array(byteCount)
    let offset = 0

    for (const chunk of chunks) {
        bytes.set(chunk, offset)
        offset += chunk.byteLength
    }

    return new TextDecoder().decode(bytes)
}

const readSequence = (value: string | null): number | undefined => {
    const sequence = value !== null && /^[0-9]{1,5}$/.test(value) ? Number(value) : undefined

    return sequence !== undefined && sequence >= 1 && sequence <= MAX_SEQUENCE ? sequence : undefined
}

/**
 * Creates a store that inserts transcripts with the given query function. A
 * record for a session and sequence that is already stored is ignored, so a
 * repeated or replayed request adds nothing.
 */
export const createTranscriptStore = (runInTransaction: RunInTransaction): StoreTranscriptRecord =>
    async ({ sessionId, sequence, user, text, timestamp }) => {
        await runInTransaction([
            lockRowLimit(TRANSCRIPT_ROW_LIMIT_LOCK),
            sql`
                insert into dictation_transcripts (session_id, sequence, user_label, transcript, occurred_at)
                select ${sessionId}::uuid, ${sequence}::integer, ${user}, ${text}, ${timestamp}::timestamptz
                where (
                    select count(*) from dictation_transcripts
                    where occurred_at > now() - interval '1 day'
                ) < ${TRANSCRIPT_DAILY_ROW_LIMIT}
                on conflict (session_id, sequence) do nothing
            `,
        ])
    }

/**
 * Creates the Neon transcript store from the environment, or returns undefined
 * when DATABASE_URL is not set, as in local development.
 */
export const createTranscriptStoreFromEnvironment = (
    env: Record<string, string | undefined>,
    connect: (connectionString: string) => RunInTransaction = connectToNeon,
): StoreTranscriptRecord | undefined => {
    const connectionString = env.DATABASE_URL?.trim()

    return connectionString ? createTranscriptStore(connect(connectionString)) : undefined
}

export interface TranscriptRequestOptions {
    /** Saves the record, never rejecting. Not called when there is nothing valid to save. */
    save?: (record: DictationTranscriptRecord) => Promise<void>
    write?: WriteTranscriptLogEntry
    getNow?: () => Date
}

/**
 * Handles a request to keep one final transcript and returns the HTTP status
 * to answer with, or undefined for any other path. The text is the request
 * body. It is passed to `save` and never logged: the log line holds only the
 * label, session, sequence and length.
 */
export const handleDictationTranscriptRequest = async (
    request: Request,
    url: URL,
    { save, write = writeEntryToServerLog, getNow = () => new Date() }: TranscriptRequestOptions = {},
): Promise<number | undefined> => {
    if (url.pathname !== DICTATION_TRANSCRIPT_PATH) {
        return undefined
    }

    if (request.method !== "POST") {
        return 405
    }

    const user = url.searchParams.get("user")
    const sessionId = url.searchParams.get("session")
    const sequence = readSequence(url.searchParams.get("sequence"))

    if (!isDictationActivityUser(user) || sessionId === null || !SESSION_ID_PATTERN.test(sessionId) || !sequence) {
        return 400
    }

    if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
        return 413
    }

    // The size is checked on the bytes as they arrive, before any decoding or
    // trimming, so that padding cannot be used to send an oversized body.
    const body = await readBodyWithinLimit(request, MAX_BODY_BYTES)

    if (body === undefined) {
        return 413
    }

    const text = body.trim()

    if (!text) {
        return 400
    }

    if (text.length > DICTATION_TRANSCRIPT_MAX_LENGTH) {
        return 413
    }

    const timestamp = getNow().toISOString()

    write({ type: "dictation_transcript", user, session: sessionId, sequence, characters: text.length, timestamp })
    await save?.({ sessionId, sequence, user, text, timestamp })

    return 204
}
