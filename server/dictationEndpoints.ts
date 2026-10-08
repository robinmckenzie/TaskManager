import type { IncomingMessage, ServerResponse } from "node:http"
import { loadEnv } from "vite"
import type { Connect, Plugin } from "vite"
import { DICTATION_TRANSCRIPT_PATH } from "../shared/dictationApi.ts"
import { handleDictationActivityRequest } from "./dictationActivity.ts"
import {
    createRealtimeToken,
    DICTATION_RESPONSE_HEADERS,
    handleDictationRequest,
    readDictationConfig,
    readDictationSettingsFile,
} from "./dictationHandler.ts"
import type { DictationResponse, DictationServerConfig } from "./dictationHandler.ts"

const sendJson = (response: ServerResponse, { status, body }: DictationResponse): void => {
    response.statusCode = status

    for (const [name, value] of Object.entries(DICTATION_RESPONSE_HEADERS)) {
        response.setHeader(name, value)
    }

    response.end(JSON.stringify(body))
}

const createDictationMiddleware = (
    getConfig: () => DictationServerConfig,
): Connect.NextHandleFunction => (
    request: IncomingMessage,
    response: ServerResponse,
    next: Connect.NextFunction,
): void => {
    const url = new URL(request.url ?? "/", "http://localhost")

    // Final transcripts are only kept by the deployed app. Locally they are
    // accepted and discarded unread.
    if (url.pathname === DICTATION_TRANSCRIPT_PATH) {
        request.resume()
        response.statusCode = 204
        response.setHeader("Cache-Control", "no-store")
        response.end()
        return
    }

    const activityStatus = handleDictationActivityRequest(request.method, url)

    if (activityStatus !== undefined) {
        response.statusCode = activityStatus
        response.setHeader("Cache-Control", "no-store")
        response.end()
        return
    }

    handleDictationRequest(request.method, url.pathname, getConfig(), createRealtimeToken)
        .then((result) => {
            if (result) {
                sendJson(response, result)
            } else {
                next()
            }
        })
        .catch(next)
}

/**
 * Adds the dictation endpoints to `npm run dev` and `npm run preview`.
 * Production hosting of these endpoints is outside TM-4.
 */
export const dictationEndpoints = (): Plugin => {
    let config: DictationServerConfig | undefined
    const middleware = createDictationMiddleware(() => {
        if (!config) {
            throw new Error("Dictation settings have not been loaded.")
        }

        return config
    })

    return {
        name: "taskmanager-dictation-endpoints",
        configResolved(resolvedConfig) {
            config = readDictationConfig(
                readDictationSettingsFile(resolvedConfig.root),
                loadEnv(resolvedConfig.mode, resolvedConfig.envDir, "SPEECHMATICS_"),
            )
        },
        configureServer(server) {
            server.middlewares.use(middleware)
        },
        configurePreviewServer(server) {
            server.middlewares.use(middleware)
        },
    }
}
