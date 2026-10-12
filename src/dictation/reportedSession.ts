import { reportSessionActivity } from "./dictationActivity"
import type { ReportDictationActivity, ReportSessionTranscript } from "./dictationActivity"
import { DictationSession } from "./dictationSession"
import type { DictationSessionDependencies, DictationSessionListener } from "./dictationSession"

/** Replacements for the reporting that a session does, for use in tests. */
export interface SessionReporters {
    report?: ReportDictationActivity
    reportTranscript?: ReportSessionTranscript
    createId?: () => string | undefined
}

/**
 * Creates a dictation session whose activity and final transcript are
 * reported. Title dictation and task descriptions both get their sessions
 * here, so both are reported in the same way.
 */
export const createReportedSession = (
    dependencies: Omit<DictationSessionDependencies, "listener">,
    listener: DictationSessionListener,
    reporters: SessionReporters = {},
): DictationSession =>
    new DictationSession({
        ...dependencies,
        listener: reportSessionActivity(
            listener,
            reporters.report,
            reporters.reportTranscript,
            reporters.createId,
        ),
    })
