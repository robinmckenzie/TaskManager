import { parse } from "smol-toml"

export const DICTATION_CONFIG_FILE = "dictation.config.toml"

export interface DictationTimings {
    inactivityTimeoutSeconds: number
    maxSessionSeconds: number
    settleTimeoutSeconds: number
}

export interface DictationSettings {
    model: string
    language: string
    realtimeUrl: string
    timings: DictationTimings
}

const SETTINGS_SCHEMA = {
    speechmatics: ["model", "language", "realtime_url"],
    timings: ["inactivity_timeout_seconds", "max_session_seconds", "settle_timeout_seconds"],
} as const

type SectionName = keyof typeof SETTINGS_SCHEMA

const fail = (message: string): never => {
    throw new Error(`${DICTATION_CONFIG_FILE}: ${message}`)
}

const isTable = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const readSection = (document: Record<string, unknown>, name: SectionName): Record<string, unknown> => {
    const section = document[name]

    if (!isTable(section)) {
        return fail(`missing [${name}] section`)
    }

    for (const key of Object.keys(section)) {
        if (/api.?key|secret|token/i.test(key)) {
            fail(`[${name}] ${key} looks like a secret; put secrets in .env.local, not in this committed file`)
        }

        if (!(SETTINGS_SCHEMA[name] as readonly string[]).includes(key)) {
            fail(`unknown setting [${name}] ${key}`)
        }
    }

    return section
}

const readText = (section: Record<string, unknown>, sectionName: SectionName, key: string): string => {
    const value = section[key]

    return typeof value === "string" && value.trim()
        ? value.trim()
        : fail(`[${sectionName}] ${key} must be a non-empty string`)
}

const readSeconds = (section: Record<string, unknown>, key: string): number => {
    const value = section[key]

    return typeof value === "number" && Number.isFinite(value) && value > 0
        ? value
        : fail(`[timings] ${key} must be a positive number of seconds`)
}

/** Parses and validates the committed dictation settings file. */
export const parseDictationSettings = (fileText: string): DictationSettings => {
    let document: Record<string, unknown>

    try {
        document = parse(fileText)
    } catch (error) {
        return fail(error instanceof Error ? error.message : "could not be parsed")
    }

    for (const name of Object.keys(document)) {
        if (!(name in SETTINGS_SCHEMA)) {
            fail(`unknown section [${name}]`)
        }
    }

    const speechmatics = readSection(document, "speechmatics")
    const timings = readSection(document, "timings")

    return {
        model: readText(speechmatics, "speechmatics", "model"),
        language: readText(speechmatics, "speechmatics", "language"),
        realtimeUrl: readText(speechmatics, "speechmatics", "realtime_url"),
        timings: {
            inactivityTimeoutSeconds: readSeconds(timings, "inactivity_timeout_seconds"),
            maxSessionSeconds: readSeconds(timings, "max_session_seconds"),
            settleTimeoutSeconds: readSeconds(timings, "settle_timeout_seconds"),
        },
    }
}
