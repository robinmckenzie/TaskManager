import { useEffect, useState } from "react"
import {
    loadAccountSession,
    loadPreferredName,
    ProfileError,
    requestSignInAddress,
    savePreferredName as sendPreferredName,
    signOut as sendSignOut,
} from "./accountClient"
import type { ProfileFailure } from "./accountClient"
import { buildReturnAddress, hasSignInError } from "./accountDisplay"

/*
 * The signed-in account, if any. It is kept apart from tasks, assignees and
 * the testing label: nothing here reads or changes them.
 */

export type ProfileState = "loading" | "ready" | "unavailable"

export type AccountView =
    | { kind: "checking" }
    | { kind: "unavailable" }
    | { kind: "signed_out" }
    | { kind: "signed_in"; name: string; email: string; preferredName: string | null; profile: ProfileState }

export type SaveResult = "saved" | ProfileFailure

export interface Account {
    view: AccountView
    /** A message about the last sign-in or sign-out, or null. */
    message: string | null
    signIn: () => void
    signOut: () => void
    savePreferredName: (preferredName: string | null) => Promise<SaveResult>
}

const SIGN_IN_FAILED = "Sign-in did not complete. Please try again."
const SIGN_IN_UNAVAILABLE = "Sign-in is unavailable at the moment. Please try again later."
const SIGN_OUT_FAILED = "Sign-out did not complete. Please try again."

/** Removes the error Better Auth added after a failed sign-in, keeping the rest of the address. */
const clearSignInErrorFromAddress = (): void => {
    window.history.replaceState(window.history.state, "", `${buildReturnAddress(window.location)}${window.location.hash}`)
}

export const useAccount = (): Account => {
    const [view, setView] = useState<AccountView>({ kind: "checking" })
    const [message, setMessage] = useState<string | null>(() =>
        // The page is also drawn without a window, in tests.
        typeof window !== "undefined" && hasSignInError(window.location.search) ? SIGN_IN_FAILED : null,
    )

    useEffect(() => {
        if (hasSignInError(window.location.search)) {
            clearSignInErrorFromAddress()
        }

        let isCurrent = true

        const load = async (): Promise<void> => {
            const session = await loadAccountSession()

            if (!isCurrent) {
                return
            }

            if (session.kind !== "signed_in") {
                setView(session)
                return
            }

            setView({ ...session, preferredName: null, profile: "loading" })

            try {
                const preferredName = await loadPreferredName()

                if (isCurrent) {
                    setView({ ...session, preferredName, profile: "ready" })
                }
            } catch (error) {
                if (!isCurrent) {
                    return
                }

                setView(
                    error instanceof ProfileError && error.failure === "signed_out"
                        ? { kind: "signed_out" }
                        : { ...session, preferredName: null, profile: "unavailable" },
                )
            }
        }

        void load()

        return () => {
            isCurrent = false
        }
    }, [])

    const signIn = (): void => {
        setMessage(null)

        requestSignInAddress(`${window.location.origin}${buildReturnAddress(window.location)}`)
            .then((address) => window.location.assign(address))
            .catch(() => setMessage(SIGN_IN_UNAVAILABLE))
    }

    const signOut = (): void => {
        setMessage(null)

        sendSignOut()
            .then(() => setView({ kind: "signed_out" }))
            .catch(() => setMessage(SIGN_OUT_FAILED))
    }

    const savePreferredName = async (preferredName: string | null): Promise<SaveResult> => {
        try {
            const saved = await sendPreferredName(preferredName)

            setView((current) =>
                current.kind === "signed_in" ? { ...current, preferredName: saved, profile: "ready" } : current,
            )

            return "saved"
        } catch (error) {
            const failure = error instanceof ProfileError ? error.failure : "unavailable"

            if (failure === "signed_out") {
                setView({ kind: "signed_out" })
            }

            return failure
        }
    }

    return { view, message, signIn, signOut, savePreferredName }
}
