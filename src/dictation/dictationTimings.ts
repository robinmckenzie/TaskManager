/** Dictation stops after this long without successfully recognised speech. */
export const INACTIVITY_TIMEOUT_MS = 10_000

/**
 * Maximum length of one dictation session, regardless of recognised speech.
 * This is an initial value, expected to be tuned after using the feature.
 */
export const MAX_SESSION_MS = 20_000

/** How long recognised text may keep settling after dictation stops. */
export const SETTLE_TIMEOUT_MS = 4_000
