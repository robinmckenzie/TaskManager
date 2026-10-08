import { handleDictationActivityRequest, writeActivityToServerLog } from "./dictationActivity.ts"
import type { DictationActivityRecord, WriteActivityRecord } from "./dictationActivity.ts"
import { createActivityStoreFromEnvironment, storeActivitySafely } from "./dictationActivityStore.ts"
import type { StoreActivityRecord } from "./dictationActivityStore.ts"
import {
    createRealtimeToken,
    DICTATION_RESPONSE_HEADERS,
    handleDictationRequest,
    readDictationConfig,
    readDictationSettingsFile,
} from "./dictationHandler.ts"
import type { CreateDictationToken, DictationServerConfig } from "./dictationHandler.ts"

/*
 * Runs the dictation API as a hosted function, for a deployment that has no
 * Vite server. It takes web-standard requests and returns web-standard
 * responses.
 */

/** Where a hosted function sends activity records. */
export interface DictationActivitySinks {
    /** Writes the record to the server log. */
    write?: WriteActivityRecord
    /** Returns the persistent store, or undefined when none is configured. */
    getStore?: () => StoreActivityRecord | undefined
}

/**
 * Creates a request handler for the dictation API. Requests for other paths
 * get a 404, because a hosted function has no other server to pass them to.
 */
export const createDictationFetchHandler = (
    getConfig: () => DictationServerConfig,
    createToken: CreateDictationToken,
    { write = writeActivityToServerLog, getStore = () => undefined }: DictationActivitySinks = {},
) => async (request: Request): Promise<Response> => {
    const url = new URL(request.url)
    let activityRecord: DictationActivityRecord | undefined
    const activityStatus = handleDictationActivityRequest(request.method, url, (record) => {
        write(record)
        activityRecord = record
    })

    if (activityStatus !== undefined) {
        const store = getStore()

        // Saved before answering, because a function may be suspended once it
        // has responded. The browser does not wait for this reply.
        if (activityRecord && store) {
            await storeActivitySafely(store, activityRecord)
        }

        return new Response(null, { status: activityStatus, headers: { "Cache-Control": "no-store" } })
    }

    const result = await handleDictationRequest(request.method, url.pathname, getConfig(), createToken)

    return result
        ? new Response(JSON.stringify(result.body), {
              status: result.status,
              headers: DICTATION_RESPONSE_HEADERS,
          })
        : new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } })
}

/**
 * Reads the hosted configuration: the settings file deployed with the
 * function, and the host's environment variables, which hold the API key and
 * any overrides. This matches how the Vite plugin combines the two locally.
 */
export const readHostedDictationConfig = (
    directory: string,
    env: Record<string, string | undefined>,
): DictationServerConfig => readDictationConfig(readDictationSettingsFile(directory), env)

let hostedConfig: DictationServerConfig | undefined
let hostedActivityStore: { store: StoreActivityRecord | undefined } | undefined

/** Handles dictation API requests in the hosted deployment. */
export const handleHostedDictationRequest = createDictationFetchHandler(
    // Read once per function instance, on its first request.
    () => (hostedConfig ??= readHostedDictationConfig(process.cwd(), process.env)),
    createRealtimeToken,
    {
        getStore: () =>
            (hostedActivityStore ??= { store: createActivityStoreFromEnvironment(process.env) }).store,
    },
)
