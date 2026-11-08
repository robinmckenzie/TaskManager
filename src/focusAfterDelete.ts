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

/**
 * Chooses the task that takes focus when a new filter hides a task that was on
 * show: the next task still on show after it in the full list, otherwise the
 * previous one. Returns undefined when no task is left on show.
 */
export const findTaskToFocusAfterHidden = (
    allTaskIds: readonly string[],
    shownTaskIds: readonly string[],
    hiddenTaskId: string,
): string | undefined => {
    const position = allTaskIds.indexOf(hiddenTaskId)

    if (position === -1) {
        return undefined
    }

    const isShown = (id: string): boolean => shownTaskIds.includes(id)

    return (
        allTaskIds.slice(position + 1).find(isShown) ??
        allTaskIds.slice(0, position).reverse().find(isShown)
    )
}
