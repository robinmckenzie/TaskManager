import { useEffect, useRef } from "react"
import type { FC } from "react"
import { MeterStyleSelector } from "./dictation/DictationFeedback"
import type { MeterChoice } from "./dictation/LevelMeter"

interface SettingsDialogProps {
    open: boolean
    meter: MeterChoice
    onMeterChange(meter: MeterChoice): void
    onClose(): void
}

/**
 * The Settings dialog, which holds the level meter choice. It is a modal
 * dialog, so Escape closes it and the page behind is out of reach. It is
 * marked as a dictation setting, so that changing the meter while dictating
 * does not stop dictation.
 */
export const SettingsDialog: FC<SettingsDialogProps> = ({ open, meter, onMeterChange, onClose }) => {
    const dialog = useRef<HTMLDialogElement>(null)

    useEffect(() => {
        const element = dialog.current

        if (!element) {
            return
        }

        if (open && !element.open) {
            element.showModal()
        } else if (!open && element.open) {
            element.close()
        }
    }, [open])

    return (
        <dialog
            ref={dialog}
            className="settings-dialog"
            aria-labelledby="settings-heading"
            data-dictation-setting
            // Escape, and the Close button, close it.
            onClose={onClose}
            // A click on the backdrop lands on the dialog itself, not its content.
            onClick={(event): void => {
                if (event.target === event.currentTarget) {
                    onClose()
                }
            }}
        >
            <div className="settings-dialog-header">
                <h2 id="settings-heading">Settings</h2>
                <button type="button" className="settings-close" onClick={onClose}>
                    Close
                </button>
            </div>
            <MeterStyleSelector meter={meter} onChange={onMeterChange} />
        </dialog>
    )
}
