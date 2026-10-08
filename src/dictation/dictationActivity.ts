import {
    DICTATION_ACTIVITY_PATH,
    DICTATION_ACTIVITY_PUBLIC_USER,
    isDictationActivityUser,
} from "../../shared/dictationApi"
import type { DictationActivityEvent } from "../../shared/dictationApi"
import type { DictationSessionListener } from "./dictationSession"

/*
 * Reports that dictation was used, so its owner can see activity on the
 * deployed app. Only an event name and a testing label are sent: never
 * transcript text or audio. Reporting is best-effort and never holds
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

/**
 * Wraps a session listener so that the session's progress is reported: when it
 * starts listening, when its first recognised words arrive, and when it ends.
 * A session that never started listening reports nothing unless it failed.
 */
export const reportSessionActivity = (
    listener: DictationSessionListener,
    report: ReportDictationActivity = reportDictationActivity,
): DictationSessionListener => {
    let hasStarted = false
    let hasReportedTranscript = false
    const reportSafely: ReportDictationActivity = (event) => {
        try {
            report(event)
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
            if (!hasReportedTranscript && tokens.length > 0) {
                hasReportedTranscript = true
                reportSafely("dictation_transcript_received")
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
        onSettled: () => listener.onSettled(),
    }
}
