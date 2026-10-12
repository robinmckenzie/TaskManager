import type { FC } from "react"
import { describeDictationPhase } from "./dictationMessages"
import { LevelMeter } from "./LevelMeter"
import type { BarLook, MeterChoice, MeterStyle, NeedleLook } from "./LevelMeter"
import { MicrophoneIcon } from "./MicrophoneIcon"
import type { Dictation } from "./useDictation"

/**
 * Says how to dictate. The microphone in it is an illustration, not a control.
 * Each part stays whole where there is room, so that a first sentence too long
 * for one line breaks before "or".
 */
export const DictationHint: FC = () => (
    <p className="dictation-hint">
        <span>
            Dictate a task title: click its{" "}
            <MicrophoneIcon label="microphone" className="dictation-hint-icon" /> button,
        </span>{" "}
        <span>or click a title and press Ctrl + Alt.</span>
        <br />
        These both toggle the mic on/off.
    </p>
)

interface DictationStatusProps {
    dictation: Dictation
    meter: MeterChoice
}

/**
 * The dictation state and latest message in a box, with the microphone level
 * while listening. The level sits outside the status text, so that assistive
 * technology announces a change of state but not each change of level.
 */
export const DictationStatus: FC<DictationStatusProps> = ({ dictation, meter }) => {
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
                    <LevelMeter choice={meter} readLevel={dictation.readAudioLevel} />
                )}
            </div>
        </div>
    )
}

interface Option<T> {
    value: T
    label: string
}

const METER_STYLES: Option<MeterStyle>[] = [
    { value: "bar", label: "Horizontal bar" },
    { value: "needle", label: "Analogue needle" },
]

const BAR_LOOKS: Option<BarLook>[] = [
    { value: "solid", label: "Solid" },
    { value: "segments", label: "Segments" },
    { value: "gradient", label: "Gradient" },
]

const NEEDLE_LOOKS: Option<NeedleLook>[] = [
    { value: "classic", label: "Classic" },
    { value: "zones", label: "Zones" },
    { value: "ticks", label: "Ticks" },
]

interface OptionButtonsProps<T> {
    options: Option<T>[]
    selected: T
    onSelect(value: T): void
}

const OptionButtons = <T extends string>({ options, selected, onSelect }: OptionButtonsProps<T>) =>
    options.map(({ value, label }) => (
        <button
            key={value}
            type="button"
            aria-pressed={selected === value}
            onClick={(): void => onSelect(value)}
        >
            {label}
        </button>
    ))

interface MeterStyleSelectorProps {
    meter: MeterChoice
    onChange(meter: MeterChoice): void
}

/**
 * Chooses how the microphone level is drawn: its style and, below, one of the
 * looks that style has. Usable while dictating.
 */
export const MeterStyleSelector: FC<MeterStyleSelectorProps> = ({ meter, onChange }) => (
    <div
        className="meter-style"
        data-dictation-setting
        // Keep focus, and the cursor position or selection, in the text input.
        onMouseDown={(event): void => event.preventDefault()}
    >
        <div role="group" aria-labelledby="meter-style-label">
            <span id="meter-style-label">Level meter</span>
            <OptionButtons
                options={METER_STYLES}
                selected={meter.style}
                onSelect={(style): void => onChange({ ...meter, style })}
            />
        </div>
        {meter.style === "bar" ? (
            <div className="meter-looks" role="group" aria-label="Horizontal bar look">
                <span aria-hidden="true">Look</span>
                <OptionButtons
                    options={BAR_LOOKS}
                    selected={meter.bar}
                    onSelect={(bar): void => onChange({ ...meter, bar })}
                />
            </div>
        ) : (
            <div className="meter-looks" role="group" aria-label="Analogue needle look">
                <span aria-hidden="true">Look</span>
                <OptionButtons
                    options={NEEDLE_LOOKS}
                    selected={meter.needle}
                    onSelect={(needle): void => onChange({ ...meter, needle })}
                />
            </div>
        )}
    </div>
)
