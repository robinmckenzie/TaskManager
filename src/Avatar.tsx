import { useState } from "react"
import type { FC } from "react"
import { getInitials } from "./users"
import type { User } from "./users"

interface AvatarProps {
    user: User | undefined
}

/**
 * An assignee's photo, with their initial behind it. The initial shows when the
 * photo cannot be loaded. It is decorative: the person's name is always given
 * in text beside it, or to screen readers.
 */
export const Avatar: FC<AvatarProps> = ({ user }) => {
    const [hasFailed, setHasFailed] = useState(false)

    return (
        <span className="avatar" aria-hidden="true">
            <span className="avatar-initials">{getInitials(user?.name)}</span>
            {user && !hasFailed && (
                <img src={user.photo} alt="" draggable={false} onError={(): void => setHasFailed(true)} />
            )}
        </span>
    )
}
