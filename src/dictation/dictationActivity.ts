import {
    DICTATION_ACTIVITY_PATH,
    DICTATION_ACTIVITY_PUBLIC_USER,
    DICTATION_TRANSCRIPT_MAX_LENGTH,
    DICTATION_TRANSCRIPT_PATH,
    isDictationActivityUser,
} from "../../shared/dictationApi"
import type { DictationActivityEvent } from "../../shared/dictationApi"
import type { DictationSessionListener } from "./dictationSession"
import { composeTokens } from "./insertionText"
import type { TranscriptToken } from "./insertionText"

/*
 * Reports dictation use, so its owner can see activity on the deployed app.
 * Activity events carry only an event name and a testing label. Each
 * session's final recognised text is reported separately, once, in a request
 * body, to be kept for diagnostics, as the app tells its users. Interim text
 * and audio are never sent. Reporting is best-effort and never holds
 * dictation up.
 */

export const ACTIVITY_USER_STORAGE_KEY = "taskmanager.activityUser"
const ACTIVITY_USER_PARAMETER = "user"

type ActivityUserStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">

/** The testing label that this page's dictation activity is reported under. */
export interface ActivityUser {
    /**
     * Applies `?user=NAME` from a page address. A valid name becomes this
     * page's label at once and is remembered for later visits. `?user=PUBLIC`
     * clears it. Anything else is ignored and changes nothing.
     */
    applyAddress(search: string): void
    /** This page's label: from its address, else as remembered, else PUBLIC. */
    read(): string
}

const isPublicUser = (label: string): boolean =>
    label.toUpperCase() === DICTATION_ACTIVITY_PUBLIC_USER

/** Finds the user parameter whatever its capitalisation, without surrounding spaces. */
const readUserParameter = (search: string): string | undefined => {
    for (const [name, value] of new URLSearchParams(search)) {
        if (name.toLowerCase() === ACTIVITY_USER_PARAMETER) {
            return value.trim()
        }
    }

    return undefined
}

/**
 * Creates the testing label for a page. A label given in the page address
 * applies to that page even when browser storage is unavailable or refuses to
 * save it, as some private browsing modes and embedded browsers do. Storage is
 * only what carries the label to later visits.
 *
 * Storage is fetched through a function because, in some browsers, merely
 * referring to `localStorage` throws when storage is blocked.
 */
export const createActivityUser = (getStorage: () => ActivityUserStorage): ActivityUser => {
    let addressUser: string | undefined

    return {
        applyAddress: (search) => {
            const label = readUserParameter(search)

            if (!isDictationActivityUser(label)) {
                return
            }

            addressUser = isPublicUser(label) ? DICTATION_ACTIVITY_PUBLIC_USER : label

            try {
                if (addressUser === DICTATION_ACTIVITY_PUBLIC_USER) {
                    getStorage().removeItem(ACTIVITY_USER_STORAGE_KEY)
                } else {
                    getStorage().setItem(ACTIVITY_USER_STORAGE_KEY, addressUser)
                }
            } catch {
                // The label still applies to this page; it is just not kept.
            }
        },
        read: () => {
            if (addressUser !== undefined) {
                return addressUser
            }

            try {
                const label = getStorage().getItem(ACTIVITY_USER_STORAGE_KEY)

                return isDictationActivityUser(label) ? label : DICTATION_ACTIVITY_PUBLIC_USER
            } catch {
                return DICTATION_ACTIVITY_PUBLIC_USER
            }
        },
    }
}

/** The testing label of the page that is running. */
export const activityUser = createActivityUser(() => localStorage)

export type ReportDictationActivity = (event: DictationActivityEvent) => void

/**
 * Creates a function that sends an activity event to the server, under the
 * label current at that moment, without waiting for a reply.
 */
export const createActivityReporter = (user: ActivityUser): ReportDictationActivity => (event) => {
    const url = `${DICTATION_ACTIVITY_PATH}?event=${event}&user=${user.read()}`

    if (!navigator.sendBeacon?.(url)) {
        void fetch(url, { method: "POST", keepalive: true }).catch(() => undefined)
    }
}

export const reportDictationActivity = createActivityReporter(activityUser)

/** Reports the complete final transcript of one dictation session. */
export type ReportSessionTranscript = (text: string, sessionId: string) => void

/**
 * Creates a function that sends a session's transcript to the server without
 * waiting for a reply. The text travels in the request body, not the address,
 * so that it does not appear in request logs.
 */
export const createTranscriptReporter = (user: ActivityUser): ReportSessionTranscript =>
    (text, sessionId) => {
        const url = `${DICTATION_TRANSCRIPT_PATH}?user=${user.read()}&session=${sessionId}`
        const body = text.slice(0, DICTATION_TRANSCRIPT_MAX_LENGTH)

        if (!navigator.sendBeacon?.(url, body)) {
            void fetch(url, { method: "POST", body, keepalive: true }).catch(() => undefined)
        }
    }

export const reportSessionTranscript = createTranscriptReporter(activityUser)

/** Makes a random identifier for one dictation session, where the browser can. */
const createSessionId = (): string | undefined => {
    try {
        return crypto.randomUUID()
    } catch {
        return undefined
    }
}

/**
 * Wraps a session listener so that the session's progress is reported: when it
 * starts listening, when its first recognised words arrive, and when it ends.
 * A session that never started listening reports nothing unless it failed.
 *
 * The session's final results are also gathered, in the order they arrive,
 * and reported together as one transcript once the session has settled, which
 * is when no more recognised text can arrive. That holds however the session
 * ended, so a session that failed or was stopped early still reports the final
 * results it had. Interim results are never part of the transcript.
 */
export const reportSessionActivity = (
    listener: DictationSessionListener,
    report: ReportDictationActivity = reportDictationActivity,
    reportTranscript: ReportSessionTranscript = reportSessionTranscript,
    createId: () => string | undefined = createSessionId,
): DictationSessionListener => {
    const sessionId = createId()
    const finalTokens: TranscriptToken[] = []
    let hasStarted = false
    let hasReportedFirstWords = false
    let hasReportedTranscript = false
    const reportSafely: ReportDictationActivity = (event) => {
        try {
            report(event)
        } catch {
            // Reporting must never interrupt dictation.
        }
    }
    const reportTranscriptOnce = (): void => {
        const text = composeTokens(finalTokens)

        if (hasReportedTranscript || !text || sessionId === undefined) {
            return
        }

        hasReportedTranscript = true

        try {
            reportTranscript(text, sessionId)
        } catch {
            // Reporting must never interrupt dictation.
        }
    }

    return {
        onListening: () => {
            hasStarted = true
            reportSafely("dictation_started")
            listener.onListening()
        },
        onTranscript: (isFinal, tokens) => {
            if (!hasReportedFirstWords && tokens.length > 0) {
                hasReportedFirstWords = true
                reportSafely("dictation_transcript_received")
            }

            if (isFinal) {
                finalTokens.push(...tokens)
            }

            listener.onTranscript(isFinal, tokens)
        },
        onStopped: (reason, errorKind) => {
            if (reason === "error") {
                reportSafely("dictation_failed")
            } else if (hasStarted) {
                reportSafely("dictation_completed")
            }

            listener.onStopped(reason, errorKind)
        },
        onSettled: () => {
            reportTranscriptOnce()
            listener.onSettled()
        },
    }
}
