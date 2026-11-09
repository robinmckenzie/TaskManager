import { useEffect, useRef } from "react"
import type { FC, KeyboardEvent } from "react"
import { Avatar } from "./Avatar"
import type { DetailField } from "./detailsPanel"
import { describeQuickDueDate } from "./quickDueDates"
import type { QuickDueDate } from "./quickDueDates"
import type { TaskControlNames } from "./taskControlNames"
import type { TaskType } from "./tasks"
import type { User } from "./users"

const PRIORITY_LEVELS = [1, 2, 3, 4, 5]

interface TaskDetailsProps {
    task: TaskType
    panelId: string
    names: TaskControlNames
    users: User[]
    quickDueDates: QuickDueDate[]
    /** The field to focus as the panel opens, or null to leave focus where it is. */
    focusField: DetailField | null
    updateTask: (id: string, changes: Partial<TaskType>) => void
    changeAssignee: (id: string, userId: string) => void
    deleteTask: (id: string) => void
    /** Closes the panel and returns focus to the row's summary button. */
    onClose: () => void
}

/**
 * The panel beneath a row: the due date with quick dates, the priority as five
 * buttons, the assignee as photo chips, and Delete. Priority and assignee are
 * radio groups, so each exposes its selected value and moves with the arrow keys.
 */
export const TaskDetails: FC<TaskDetailsProps> = ({
    task,
    panelId,
    names,
    users,
    quickDueDates,
    focusField,
    updateTask,
    changeAssignee,
    deleteTask,
    onClose,
}) => {
    const panel = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (focusField) {
            panel.current?.querySelector<HTMLElement>(`[data-focus="${focusField}"]`)?.focus()
        }
        // Only as the panel opens.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
        if (event.key === "Escape") {
            event.stopPropagation()
            onClose()
        }
    }

    return (
        <div
            ref={panel}
            id={panelId}
            className="task-details"
            role="group"
            aria-label={`Details for ${names.dictationTarget}`}
            onKeyDown={handleKeyDown}
        >
            <div className="detail-field">
                <span className="detail-label" aria-hidden="true">
                    Due date
                </span>
                <div className="detail-due">
                    <input
                        type="date"
                        className="detail-date"
                        data-focus="due"
                        value={task.dueDate}
                        onChange={(event): void => updateTask(task.id, { dueDate: event.target.value })}
                        aria-label={names.dueDate}
                    />
                    {quickDueDates.map((quickDueDate: QuickDueDate) => (
                        <button
                            key={quickDueDate.name}
                            type="button"
                            className="quick-date"
                            aria-pressed={task.dueDate === quickDueDate.dueDate}
                            aria-label={describeQuickDueDate(quickDueDate, names.dictationTarget)}
                            onClick={(): void => updateTask(task.id, { dueDate: quickDueDate.dueDate })}
                        >
                            {quickDueDate.name}
                        </button>
                    ))}
                </div>
            </div>

            <div className="detail-field">
                <span className="detail-label" aria-hidden="true">
                    Priority
                </span>
                <div className="detail-segmented" role="radiogroup" aria-label={names.priority}>
                    {PRIORITY_LEVELS.map((level: number) => (
                        <label key={level} className="detail-segment">
                            <input
                                type="radio"
                                name={`priority-${task.id}`}
                                data-focus={task.priority === level ? "priority" : undefined}
                                checked={task.priority === level}
                                onChange={(): void => updateTask(task.id, { priority: level })}
                                aria-label={`${level} of 5${level === 1 ? ", lowest" : level === 5 ? ", highest" : ""}`}
                            />
                            <span aria-hidden="true">{level}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div className="detail-field">
                <span className="detail-label" aria-hidden="true">
                    Assignee
                </span>
                <div className="detail-people" role="radiogroup" aria-label={names.assignee}>
                    {users.map((user: User) => (
                        <label key={user.id} className="detail-person">
                            <input
                                type="radio"
                                name={`assignee-${task.id}`}
                                data-focus={task.userId === user.id ? "assignee" : undefined}
                                checked={task.userId === user.id}
                                onChange={(): void => changeAssignee(task.id, user.id)}
                            />
                            <Avatar user={user} />
                            <span>{user.name}</span>
                        </label>
                    ))}
                </div>
            </div>

            <button
                type="button"
                className="delete-button"
                onClick={(): void => deleteTask(task.id)}
                aria-label={names.deleteButton}
            >
                Delete
            </button>
        </div>
    )
}
