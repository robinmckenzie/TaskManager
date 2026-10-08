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

const isPublicUser = (label: string): boolean =>
    label.toUpperCase() === DICTATION_ACTIVITY_PUBLIC_USER

/**
 * Sets this browser's testing label when the page address carries
 * `?user=NAME`, and remembers it in local storage. `?user=PUBLIC` clears it.
 * A value that is not a valid label is ignored and changes nothing.
 */
export const rememberActivityUserFromAddress = (
    search: string,
    storage: Pick<Storage, "setItem" | "removeItem">,
): void => {
    const label = new URLSearchParams(search).get(ACTIVITY_USER_PARAMETER)

    if (!isDictationActivityUser(label)) {
        return
    }

    try {
        if (isPublicUser(label)) {
            storage.removeItem(ACTIVITY_USER_STORAGE_KEY)
        } else {
            storage.setItem(ACTIVITY_USER_STORAGE_KEY, label)
        }
    } catch {
        // Without storage, activity is reported as PUBLIC.
    }
}

/** This browser's testing label, or PUBLIC when none has been set. */
export const readActivityUser = (storage: Pick<Storage, "getItem">): string => {
    try {
        const label = storage.getItem(ACTIVITY_USER_STORAGE_KEY)

        return isDictationActivityUser(label) ? label : DICTATION_ACTIVITY_PUBLIC_USER
    } catch {
        return DICTATION_ACTIVITY_PUBLIC_USER
    }
}

export type ReportDictationActivity = (event: DictationActivityEvent) => void

/** Sends an activity event to the server without waiting for a reply. */
export const reportDictationActivity: ReportDictationActivity = (event) => {
    const url = `${DICTATION_ACTIVITY_PATH}?event=${event}&user=${readActivityUser(localStorage)}`

    if (!navigator.sendBeacon?.(url)) {
        void fetch(url, { method: "POST", keepalive: true }).catch(() => undefined)
    }
}

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
