import type { FC } from "react"
import type { Dictation } from "./useDictation"

interface DictationButtonProps {
    targetId: string
    dictation: Dictation
}

const getButtonTitle = (dictation: Dictation, isActive: boolean): string => {
    if (isActive) {
        return "Stop dictation (Ctrl + Alt)"
    }

    switch (dictation.availability) {
        case "available":
            return "Dictate into this title (Ctrl + Alt)"
        case "checking":
            return "Checking whether dictation is available"
        case "not_configured":
            return "Dictation is not configured"
        case "unsupported":
            return "Dictation is not supported in this browser"
    }
}

/** Microphone control that starts or stops dictation into its text input. */
export const DictationButton: FC<DictationButtonProps> = ({ targetId, dictation }) => {
    const isActive = dictation.phase !== "idle" && dictation.activeTargetId === targetId
    const isAvailable = dictation.availability === "available"

    return (
        <button
            type="button"
            ref={(button): void => dictation.registerButton(targetId, button)}
            className={`dictation-button${dictation.phase === "starting" && isActive ? " dictation-button-starting" : ""}`}
            aria-pressed={isActive}
            aria-disabled={isAvailable ? undefined : true}
            aria-label={isActive ? "Stop dictation" : "Start dictation"}
            title={getButtonTitle(dictation, isActive)}
            // Keep focus, and the cursor position or selection, in the text input.
            onMouseDown={(event): void => event.preventDefault()}
            onClick={(): void => dictation.toggleFromButton(targetId)}
        >
            <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16">
                <path
                    fill="currentColor"
                    d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"
                />
            </svg>
        </button>
    )
}
