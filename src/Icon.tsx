import type { FC } from "react"

/* Each icon is one filled path in a 16 by 16 box. */
const ICON_PATHS = {
    mark: "M3 1.5h10A1.5 1.5 0 0 1 14.5 3v10a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 13V3A1.5 1.5 0 0 1 3 1.5Zm8.03 4.47a.75.75 0 0 0-1.06 0L7 8.94 6.03 7.97a.75.75 0 1 0-1.06 1.06l1.5 1.5a.75.75 0 0 0 1.06 0l3.5-3.5a.75.75 0 0 0 0-1.06Z",
    plus: "M7.25 2.75a.75.75 0 0 1 1.5 0v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5Z",
    grip: "M6 3a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm4 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2ZM6 7a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm4 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm-4 4a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm4 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z",
    /* The due states. Each has its own shape, so that no state depends on colour. */
    warning: "M7.13 1.5a1 1 0 0 1 1.74 0l6.5 11.5a1 1 0 0 1-.87 1.5H1.5a1 1 0 0 1-.87-1.5l6.5-11.5ZM7.25 5.5v4h1.5v-4h-1.5Zm0 5.25v1.5h1.5v-1.5h-1.5Z",
    clock: "M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1Zm0 1.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Zm.75 2v3.19l2.03 2.03-1.06 1.06L7.25 8.31V4.5h1.5Z",
    calendar: "M5 1h1.5v1.5h3V1H11v1.5h1.5A1.5 1.5 0 0 1 14 4v8.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12.5V4a1.5 1.5 0 0 1 1.5-1.5H5V1ZM3.5 6.5v6h9v-6h-9Z",
    arrow: "M2 8a.75.75 0 0 1 .75-.75h8.69L8.97 4.78a.75.75 0 0 1 1.06-1.06l3.75 3.75a.75.75 0 0 1 0 1.06l-3.75 3.75a.75.75 0 1 1-1.06-1.06l2.47-2.47H2.75A.75.75 0 0 1 2 8Z",
    dash: "M3 7.25h10v1.5H3z",
    check: "M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1Zm3.03 4.47a.75.75 0 0 0-1.06 0L7 8.44 6.03 7.47a.75.75 0 1 0-1.06 1.06l1.5 1.5a.75.75 0 0 0 1.06 0l3.5-3.5a.75.75 0 0 0 0-1.06Z",
    users: "M5.5 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Zm5.5 1a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM1 12.5C1 10.6 3 9 5.5 9S10 10.6 10 12.5V14H1v-1.5Zm10.5 1.5v-1.5c0-1-.3-1.9-.9-2.6 2.2-.1 4.4 1 4.4 2.6V14h-3.5Z",
}

export type IconName = keyof typeof ICON_PATHS

interface IconProps {
    name: IconName
    className?: string
    size?: number
}

/** A small decorative icon. It is hidden from assistive technology, so the control around it needs its own name. */
export const Icon: FC<IconProps> = ({ name, className, size = 16 }) => (
    <svg className={className} viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
        <path d={ICON_PATHS[name]} fill="currentColor" />
    </svg>
)
