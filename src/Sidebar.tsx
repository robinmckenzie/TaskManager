import type { FC } from "react"
import { getVisibleTasks } from "./assigneeFilter"
import { Avatar } from "./Avatar"
import { DictationHint } from "./dictation/DictationFeedback"
import { Icon } from "./Icon"
import type { TaskType } from "./tasks"
import type { User } from "./users"

interface SidebarProps {
    tasks: TaskType[]
    /** The assignees in the order to list them. */
    users: User[]
    /** The id of the assignee the list is filtered to, or "" for all. */
    assigneeFilter: string
    onFilterChange: (assigneeId: string) => void
    onOpenSettings: () => void
}

/**
 * The app's name, the assignee filter as a list with a task count for each
 * person, and how to dictate, with the notice that dictated text may be kept, and the way to open Settings.
 */
export const Sidebar: FC<SidebarProps> = ({
    tasks,
    users,
    assigneeFilter,
    onFilterChange,
    onOpenSettings,
}) => (
    <aside className="sidebar">
        <div className="sidebar-brand">
            <Icon name="mark" size={22} className="sidebar-brand-mark" />
            <span>Task Manager</span>
        </div>

        <nav className="assignee-filter" aria-labelledby="assignee-filter-heading">
            <h2 id="assignee-filter-heading" className="sidebar-heading">
                Assignee
            </h2>
            <ul>
                <li>
                    <button
                        type="button"
                        className="filter-item"
                        aria-pressed={assigneeFilter === ""}
                        onClick={(): void => onFilterChange("")}
                    >
                        <span className="filter-icon">
                            <Icon name="users" />
                        </span>
                        <span className="filter-name">All assignees</span>
                        <span className="filter-count">{tasks.length}</span>
                    </button>
                </li>
                {users.map((user: User) => (
                    <li key={user.id}>
                        <button
                            type="button"
                            className="filter-item"
                            aria-pressed={assigneeFilter === user.id}
                            onClick={(): void => onFilterChange(user.id)}
                        >
                            <Avatar user={user} />
                            <span className="filter-name">{user.name}</span>
                            <span className="filter-count">{getVisibleTasks(tasks, user.id).length}</span>
                        </button>
                    </li>
                ))}
            </ul>
        </nav>

        <section className="sidebar-card" aria-labelledby="dictation-heading">
            <h2 id="dictation-heading" className="sidebar-heading">
                Dictation
            </h2>
            <DictationHint />
            <p className="dictation-notice">This demo may retain dictated text for diagnostics.</p>
        </section>

        <div className="sidebar-footer">
            {/* A dictation setting: opening Settings does not stop dictation, and
                a mouse press leaves focus where it was, to return to on close. */}
            <button
                type="button"
                className="settings-button"
                data-dictation-setting
                onMouseDown={(event): void => event.preventDefault()}
                onClick={onOpenSettings}
            >
                <Icon name="sliders" />
                Settings
            </button>
        </div>
    </aside>
)
