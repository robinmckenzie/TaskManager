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

/**
 * Creates a request handler for the dictation API. Requests for other paths
 * get a 404, because a hosted function has no other server to pass them to.
 */
export const createDictationFetchHandler = (
    getConfig: () => DictationServerConfig,
    createToken: CreateDictationToken,
) => async (request: Request): Promise<Response> => {
    const result = await handleDictationRequest(
        request.method,
        new URL(request.url).pathname,
        getConfig(),
        createToken,
    )

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

/** Handles dictation API requests in the hosted deployment. */
export const handleHostedDictationRequest = createDictationFetchHandler(
    // Read once per function instance, on its first request.
    () => (hostedConfig ??= readHostedDictationConfig(process.cwd(), process.env)),
    createRealtimeToken,
)
