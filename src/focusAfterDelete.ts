/**
 * Chooses the task that takes focus when a task on show is deleted: the next
 * one on show, otherwise the previous one. Returns undefined when no other
 * task is on show.
 */
export const findTaskToFocusAfterDelete = (
    visibleTaskIds: readonly string[],
    deletedTaskId: string,
): string | undefined => {
    const position = visibleTaskIds.indexOf(deletedTaskId)

    if (position === -1) {
        return undefined
    }

    return visibleTaskIds[position + 1] ?? visibleTaskIds[position - 1]
}
