import type { FC } from "react"
import { MicrophoneIcon } from "./MicrophoneIcon"
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
            <MicrophoneIcon />
        </button>
    )
}
