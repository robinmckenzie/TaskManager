import { readFileSync } from "node:fs"
import { join } from "node:path"
import { createSpeechmaticsJWT, SpeechmaticsJWTError } from "@speechmatics/auth"
import { DICTATION_STATUS_PATH, DICTATION_TOKEN_PATH } from "../shared/dictationApi.ts"
import type {
    DictationErrorResponse,
    DictationStatusResponse,
    DictationTimings,
    DictationToken,
} from "../shared/dictationApi.ts"
import { DICTATION_CONFIG_FILE, parseDictationSettings } from "./dictationConfig.ts"
import type { DictationSettings } from "./dictationConfig.ts"

/*
 * The dictation API, independent of any server framework, so that the Vite
 * plugin used in development and the hosted function share one implementation.
 */

// Speechmatics temporary keys must live for at least 60 seconds.
const TOKEN_TTL_SECONDS = 60

export interface DictationServerConfig {
    apiKey?: string
    model: string
    language: string
    url: string
    timings: DictationTimings
}

export interface DictationResponse {
    status: number
    body: DictationStatusResponse | DictationToken | DictationErrorResponse
}

export type CreateDictationToken = (apiKey: string) => Promise<string>

const readSetting = (value: string | undefined): string | undefined =>
    value?.trim() || undefined

/**
 * Combines the committed settings file with SPEECHMATICS_* environment
 * variables, which hold the API key and optional per-machine overrides.
 * The API key stays on the server and is never returned to the browser.
 */
export const readDictationConfig = (
    settings: DictationSettings,
    env: Record<string, string | undefined>,
): DictationServerConfig => ({
    apiKey: readSetting(env.SPEECHMATICS_API_KEY),
    model: readSetting(env.SPEECHMATICS_MODEL) ?? settings.model,
    language: readSetting(env.SPEECHMATICS_LANGUAGE) ?? settings.language,
    url: readSetting(env.SPEECHMATICS_RT_URL) ?? settings.realtimeUrl,
    timings: settings.timings,
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
    if (path === DICTATION_STATUS_PATH) {
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
                    timings: config.timings,
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

/** Headers sent with every dictation API response. */
export const DICTATION_RESPONSE_HEADERS = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
} as const

/** Reads and validates the settings file in the given directory. */
export const readDictationSettingsFile = (directory: string): DictationSettings =>
    parseDictationSettings(readFileSync(join(directory, DICTATION_CONFIG_FILE), "utf8"))
