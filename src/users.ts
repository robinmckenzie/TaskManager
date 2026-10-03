interface Assignee {
    id: string
}

export const sortAssigneesByName = <T extends Assignee & { name: string }>(
    users: readonly T[],
): T[] => [...users].sort((left, right) => left.name.localeCompare(right.name))

export const getNewTaskAssignee = (
    selection: string,
    users: readonly Assignee[],
): string => {
    const selectedUser = users.find((user) => user.id === selection)
    return selectedUser?.id || users[0]?.id || ""
}
