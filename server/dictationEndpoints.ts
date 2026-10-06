import type { IncomingMessage, ServerResponse } from "node:http"
import { createSpeechmaticsJWT, SpeechmaticsJWTError } from "@speechmatics/auth"
import { loadEnv } from "vite"
import type { Connect, Plugin } from "vite"

export const DICTATION_CONFIG_PATH = "/api/dictation/config"
export const DICTATION_TOKEN_PATH = "/api/dictation/token"

// Speechmatics temporary keys must live for at least 60 seconds.
const TOKEN_TTL_SECONDS = 60

export interface DictationServerConfig {
    apiKey?: string
    model: string
    language: string
    url: string
}

export interface DictationResponse {
    status: number
    body: unknown
}

export type CreateDictationToken = (apiKey: string) => Promise<string>

const readSetting = (value: string | undefined): string | undefined =>
    value?.trim() || undefined

/**
 * Reads dictation settings from SPEECHMATICS_* environment variables.
 * The API key stays on the server and is never returned to the browser.
 */
export const readDictationConfig = (
    env: Record<string, string | undefined>,
): DictationServerConfig => ({
    apiKey: readSetting(env.SPEECHMATICS_API_KEY),
    model: readSetting(env.SPEECHMATICS_MODEL) ?? "enhanced",
    language: readSetting(env.SPEECHMATICS_LANGUAGE) ?? "en",
    url: readSetting(env.SPEECHMATICS_RT_URL) ?? "wss://eu.rt.speechmatics.com/v2",
})

export const createRealtimeToken: CreateDictationToken = (apiKey) =>
    createSpeechmaticsJWT({ type: "rt", apiKey, ttl: TOKEN_TTL_SECONDS })

const isUnauthorizedTokenError = (error: unknown): boolean =>
    error instanceof SpeechmaticsJWTError && error.type === "Unauthorized"

/**
 * Handles the dictation API routes. Returns undefined for other paths so the
 * request can continue to the rest of the development or preview server.
 */
export const handleDictationRequest = async (
    method: string | undefined,
    path: string,
    config: DictationServerConfig,
    createToken: CreateDictationToken,
): Promise<DictationResponse | undefined> => {
    if (path === DICTATION_CONFIG_PATH) {
        if (method !== "GET") {
            return { status: 405, body: { error: "method_not_allowed" } }
        }

        return { status: 200, body: { configured: config.apiKey !== undefined } }
    }

    if (path === DICTATION_TOKEN_PATH) {
        if (method !== "POST") {
            return { status: 405, body: { error: "method_not_allowed" } }
        }

        if (config.apiKey === undefined) {
            return { status: 503, body: { error: "not_configured" } }
        }

        try {
            const jwt = await createToken(config.apiKey)

            return {
                status: 200,
                body: {
                    jwt,
                    url: config.url,
                    model: config.model,
                    language: config.language,
                },
            }
        } catch (error) {
            return {
                status: 502,
                body: {
                    error: isUnauthorizedTokenError(error)
                        ? "not_authorised"
                        : "service_unavailable",
                },
            }
        }
    }

    return undefined
}

const sendJson = (response: ServerResponse, { status, body }: DictationResponse): void => {
    response.statusCode = status
    response.setHeader("Content-Type", "application/json")
    response.setHeader("Cache-Control", "no-store")
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
    let config = readDictationConfig({})
    const middleware = createDictationMiddleware(() => config)

    return {
        name: "taskmanager-dictation-endpoints",
        configResolved(resolvedConfig) {
            config = readDictationConfig(
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
