import { DICTATION_ACTIVITY_PATH } from "../../shared/dictationApi"
import type { DictationActivityEvent, DictationActivityMode } from "../../shared/dictationApi"
import type { DictationSessionListener } from "./dictationSession"

/*
 * Reports that dictation was used, so its owner can see activity on the
 * deployed app. Only an event name and a mode are sent: never transcript text
 * or audio. Reporting is best-effort and never holds dictation up.
 */

export const DEV_MODE_STORAGE_KEY = "taskmanager.devMode"
const DEV_MODE_PARAMETER = "devmode"

/**
 * Turns DEV mode on or off for this browser when the page address carries
 * `?devmode=on` or `?devmode=off`, and remembers the choice in local storage.
 */
export const rememberDevModeFromAddress = (
    search: string,
    storage: Pick<Storage, "setItem" | "removeItem">,
): void => {
    const choice = new URLSearchParams(search).get(DEV_MODE_PARAMETER)

    try {
        if (choice === "on") {
            storage.setItem(DEV_MODE_STORAGE_KEY, "on")
        } else if (choice === "off") {
            storage.removeItem(DEV_MODE_STORAGE_KEY)
        }
    } catch {
        // Without storage, activity is reported as PUBLIC.
    }
}

/** DEV when this browser has been marked as its owner's, otherwise PUBLIC. */
export const readActivityMode = (storage: Pick<Storage, "getItem">): DictationActivityMode => {
    try {
        return storage.getItem(DEV_MODE_STORAGE_KEY) === "on" ? "DEV" : "PUBLIC"
    } catch {
        return "PUBLIC"
    }
}

export type ReportDictationActivity = (event: DictationActivityEvent) => void

/** Sends an activity event to the server without waiting for a reply. */
export const reportDictationActivity: ReportDictationActivity = (event) => {
    const url = `${DICTATION_ACTIVITY_PATH}?event=${event}&mode=${readActivityMode(localStorage)}`

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
