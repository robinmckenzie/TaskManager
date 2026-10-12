import type { FC } from "react"

interface MicrophoneIconProps {
    /** Read out in place of the icon. Without it the icon is decorative. */
    label?: string
    className?: string
}

/** The microphone drawn in the dictation buttons. */
export const MicrophoneIcon: FC<MicrophoneIconProps> = ({ label, className }) => (
    <svg
        className={className}
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        viewBox="0 0 24 24"
        width="16"
        height="16"
    >
        <path
            fill="currentColor"
            d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"
        />
    </svg>
)
