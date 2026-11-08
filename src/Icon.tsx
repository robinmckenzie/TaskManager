import type { FC } from "react"

/* Each icon is one filled path in a 16 by 16 box. */
const ICON_PATHS = {
    mark: "M3 1.5h10A1.5 1.5 0 0 1 14.5 3v10a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 13V3A1.5 1.5 0 0 1 3 1.5Zm8.03 4.47a.75.75 0 0 0-1.06 0L7 8.94 6.03 7.97a.75.75 0 1 0-1.06 1.06l1.5 1.5a.75.75 0 0 0 1.06 0l3.5-3.5a.75.75 0 0 0 0-1.06Z",
    plus: "M7.25 2.75a.75.75 0 0 1 1.5 0v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5Z",
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
