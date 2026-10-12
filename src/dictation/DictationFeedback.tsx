import type { FC } from "react"
import { describeDictationPhase } from "./dictationMessages"
import { LevelMeter } from "./LevelMeter"
import type { MeterStyle } from "./LevelMeter"
import { MicrophoneIcon } from "./MicrophoneIcon"
import type { Dictation } from "./useDictation"

/** Says how to dictate. The microphone in it is an illustration, not a control. */
export const DictationHint: FC = () => (
    <p className="dictation-hint">
        Dictate a task title: click its{" "}
        <MicrophoneIcon label="microphone" className="dictation-hint-icon" /> button, or
        click a title and press Ctrl + Alt. These both toggle the mic on/off.
    </p>
)

interface DictationStatusProps {
    dictation: Dictation
    meterStyle: MeterStyle
}

/**
 * The dictation state and latest message in a box, with the microphone level
 * while listening. The level sits outside the status text, so that assistive
 * technology announces a change of state but not each change of level.
 */
export const DictationStatus: FC<DictationStatusProps> = ({ dictation, meterStyle }) => {
    const { phase, message } = dictation
    const stateText = describeDictationPhase(phase)
    const isEmpty = !stateText && !message

    return (
        <div className="dictation-feedback">
            <div className={`dictation-status-box${isEmpty ? " dictation-status-box-empty" : ""}`}>
                <p className="dictation-status" role="status">
                    {stateText && (
                        <strong className={`dictation-state dictation-state-${phase}`}>
                            {stateText}
                        </strong>
                    )}
                    {stateText && message && " "}
                    {message}
                </p>
                {phase === "listening" && (
                    <LevelMeter meterStyle={meterStyle} readLevel={dictation.readAudioLevel} />
                )}
            </div>
        </div>
    )
}

const METER_STYLES: { value: MeterStyle; label: string }[] = [
    { value: "bar", label: "Horizontal bar" },
    { value: "needle", label: "Analogue needle" },
]

interface MeterStyleSelectorProps {
    meterStyle: MeterStyle
    onChange(meterStyle: MeterStyle): void
}

/** Chooses how the microphone level is drawn. Usable while dictating. */
export const MeterStyleSelector: FC<MeterStyleSelectorProps> = ({ meterStyle, onChange }) => (
    <div
        className="meter-style"
        role="group"
        aria-labelledby="meter-style-label"
        data-dictation-setting
        // Keep focus, and the cursor position or selection, in the text input.
        onMouseDown={(event): void => event.preventDefault()}
    >
        <span id="meter-style-label">Level meter</span>
        {METER_STYLES.map(({ value, label }) => (
            <button
                key={value}
                type="button"
                aria-pressed={meterStyle === value}
                onClick={(): void => onChange(value)}
            >
                {label}
            </button>
        ))}
    </div>
)
