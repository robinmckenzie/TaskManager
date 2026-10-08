import type { IncomingMessage, ServerResponse } from "node:http"
import { loadEnv } from "vite"
import type { Connect, Plugin } from "vite"
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
    const path = new URL(request.url ?? "/", "http://localhost").pathname

    handleDictationRequest(request.method, path, getConfig(), createRealtimeToken)
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
