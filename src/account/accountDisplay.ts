/*
 * What the account control shows, and the addresses sign-in returns to. Kept
 * apart from React so that it can be tested on its own.
 */

/** The name shown while signed in: the preferred name once set, else Google's. */
export const chooseDisplayName = (googleName: string, preferredName: string | null): string =>
    preferredName ?? (googleName.trim() || "your Google account")

/** Query parameters Better Auth adds when a sign-in fails. */
const SIGN_IN_ERROR_PARAMETERS = ["error", "error_description"] as const

/**
 * The address to come back to after signing in: this page's path and query,
 * so that a `?user=` testing label is kept. Better Auth accepts a relative
 * address, and only follows one on the same site.
 */
export const buildReturnAddress = ({ pathname, search }: Pick<Location, "pathname" | "search">): string => {
    const parameters = new URLSearchParams(search)

    for (const name of SIGN_IN_ERROR_PARAMETERS) {
        parameters.delete(name)
    }

    const query = parameters.toString()

    return query ? `${pathname}?${query}` : pathname
}

/** Whether the address is one Better Auth returned to after a failed sign-in. */
export const hasSignInError = (search: string): boolean => new URLSearchParams(search).has("error")
