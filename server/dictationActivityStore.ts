import { neon } from "@neondatabase/serverless"
import type { DictationActivityRecord } from "./dictationActivity.ts"

/*
 * Keeps dictation activity in a Neon Postgres database, so that it outlives
 * the server log. The table is created once from dictationActivity.sql and is
 * never created or checked here.
 */

/** Saves one activity record. Rejects if it could not be saved. */
export type StoreActivityRecord = (record: DictationActivityRecord) => Promise<void>

/** One SQL statement with its parameters kept apart from its text. */
export interface SqlStatement {
    strings: TemplateStringsArray
    values: unknown[]
}

/** Writes a statement as a tagged template, keeping its values as parameters. */
export const sql = (strings: TemplateStringsArray, ...values: unknown[]): SqlStatement => ({ strings, values })

/** Runs statements in order inside a single database transaction. */
export type RunInTransaction = (statements: SqlStatement[]) => Promise<unknown>

/** Connects to Neon. Nothing is sent until a transaction is run. */
export const connectToNeon = (connectionString: string): RunInTransaction => {
    const query = neon(connectionString)

    return (statements) =>
        query.transaction(statements.map(({ strings, values }) => query(strings, ...values)))
}

/**
 * Takes the lock that makes a table's row limit exact. Counting rows and then
 * inserting is not safe when requests arrive together: each could count before
 * any had inserted, and all would insert. Each save therefore first takes a
 * lock for its table, held until its transaction ends, so that saves to one
 * table happen one at a time and each count sees the inserts before it.
 *
 * This must be a statement of its own, before the insert, because a statement
 * only sees rows committed before it began.
 */
export const lockRowLimit = (lockKey: number): SqlStatement =>
    sql`select pg_advisory_xact_lock(${lockKey}::bigint)`

const ACTIVITY_ROW_LIMIT_LOCK = 724_050_001

/**
 * The most rows stored in any 24 hours. Further events are skipped until
 * earlier ones are a day old, which bounds what a flood of requests can add.
 */
export const ACTIVITY_DAILY_ROW_LIMIT = 1000

/** How long a save may take before it is abandoned. */
export const ACTIVITY_STORE_TIMEOUT_MS = 5000

/** Creates a store that inserts records through the given database. */
export const createActivityStore = (runInTransaction: RunInTransaction): StoreActivityRecord =>
    async ({ event, user, timestamp }) => {
        await runInTransaction([
            lockRowLimit(ACTIVITY_ROW_LIMIT_LOCK),
            sql`
                insert into dictation_activity (event, user_label, occurred_at)
                select ${event}, ${user}, ${timestamp}::timestamptz
                where (
                    select count(*) from dictation_activity
                    where occurred_at > now() - interval '1 day'
                ) < ${ACTIVITY_DAILY_ROW_LIMIT}
            `,
        ])
    }

/**
 * Creates the Neon store from the environment, or returns undefined when
 * DATABASE_URL is not set, as in local development. Nothing connects to the
 * database until a record is saved.
 */
export const createActivityStoreFromEnvironment = (
    env: Record<string, string | undefined>,
    connect: (connectionString: string) => RunInTransaction = connectToNeon,
): StoreActivityRecord | undefined => {
    const connectionString = env.DATABASE_URL?.trim()

    return connectionString ? createActivityStore(connect(connectionString)) : undefined
}

/** A database error code such as 42P01. Unlike an error message, it cannot hold details. */
const readErrorCode = (error: unknown): string | undefined => {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined

    return typeof code === "string" && /^[0-9A-Z]{5}$/.test(code) ? code : undefined
}

const reportStoreFailure = (code: string | undefined): void => {
    console.error(JSON.stringify({ type: "dictation_activity_store_failed", code }))
}

/**
 * Saves a record without ever rejecting: a failure or a slow database is
 * reported and otherwise ignored. Only a fixed message and a database error
 * code are reported, never the error's message, which could hold connection
 * details.
 */
export const storeActivitySafely = async <Record>(
    store: (record: Record) => Promise<void>,
    record: Record,
    reportFailure: (code: string | undefined) => void = reportStoreFailure,
): Promise<void> => {
    let timer: ReturnType<typeof setTimeout> | undefined

    try {
        await Promise.race([
            store(record),
            new Promise<never>((_resolve, reject) => {
                timer = setTimeout(() => reject(new Error("timed out")), ACTIVITY_STORE_TIMEOUT_MS)
            }),
        ])
    } catch (error) {
        reportFailure(readErrorCode(error))
    } finally {
        clearTimeout(timer)
    }
}
