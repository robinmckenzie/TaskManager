import { useId, useState } from "react"
import type { FC, FormEvent } from "react"
import { normalisePreferredName, PREFERRED_NAME_MAX_LENGTH } from "../../shared/accountApi"
import { chooseDisplayName } from "./accountDisplay"
import { useAccount } from "./useAccount"
import type { Account, SaveResult } from "./useAccount"

/*
 * The account area: who is signed in, the preferred name, what is kept, and
 * signing in and out. It is plain text with no picture, so that it cannot be
 * mistaken for an assignee or the testing label.
 */

const SAVE_MESSAGES: Record<SaveResult, string> = {
    saved: "Saved.",
    invalid: `Enter 1 to ${PREFERRED_NAME_MAX_LENGTH} characters.`,
    unavailable: "Your preferred name could not be saved. Please try again later.",
    signed_out: "You have been signed out.",
}

interface ProfilePanelProps {
    account: Account
    name: string
    email: string
    preferredName: string | null
    isProfileReady: boolean
    panelId: string
}

const ProfilePanel: FC<ProfilePanelProps> = ({ account, name, email, preferredName, isProfileReady, panelId }) => {
    const [draft, setDraft] = useState(preferredName ?? "")
    const [saveMessage, setSaveMessage] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const inputId = useId()

    const save = async (value: string | null): Promise<void> => {
        if (value !== null && normalisePreferredName(value) === undefined) {
            setSaveMessage(SAVE_MESSAGES.invalid)
            return
        }

        setIsSaving(true)
        setSaveMessage(null)
        const result = await account.savePreferredName(value === null ? null : value.trim())
        setIsSaving(false)

        if (result === "saved") {
            setDraft(value?.trim() ?? "")
        }

        setSaveMessage(SAVE_MESSAGES[result])
    }

    const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
        event.preventDefault()
        void save(draft)
    }

    return (
        <section id={panelId} className="account-panel" aria-label="Your account">
            {isProfileReady ? (
                <form className="account-profile" onSubmit={handleSubmit}>
                    <label htmlFor={inputId}>Preferred name</label>
                    <div className="account-profile-row">
                        <input
                            id={inputId}
                            type="text"
                            value={draft}
                            maxLength={PREFERRED_NAME_MAX_LENGTH}
                            onChange={(event) => setDraft(event.target.value)}
                            disabled={isSaving}
                        />
                        <button type="submit" disabled={isSaving}>
                            Save
                        </button>
                        {preferredName !== null && (
                            <button type="button" onClick={() => void save(null)} disabled={isSaving}>
                                Clear
                            </button>
                        )}
                    </div>
                    <p className="account-hint">
                        Shown only to you, instead of your Google name.
                    </p>
                    <p className="account-save-message" role="status">
                        {saveMessage}
                    </p>
                </form>
            ) : (
                <p className="account-hint" role="status">
                    Your preferred name is unavailable at the moment.
                </p>
            )}

            <h2>What TaskManager keeps about you</h2>
            <ul>
                <li>The permanent ID that Google gives your account.</li>
                <li>
                    Your name and email address as Google gave them when you first signed in:{" "}
                    {name}, {email}.
                </li>
                <li>Your preferred name, if you set one.</li>
                <li>A sign-in record for each browser you use, which ends when you sign out.</li>
            </ul>
            <p className="account-hint">
                Your tasks stay in this browser and are not linked to your account.{" "}
                <a href="/privacy.html">Privacy</a>
            </p>

            <button type="button" className="account-sign-out" onClick={account.signOut}>
                Sign out
            </button>
        </section>
    )
}

export const AccountControl: FC = () => {
    const account = useAccount()
    const [isOpen, setIsOpen] = useState(false)
    const panelId = useId()
    const { view, message } = account

    return (
        <div className="account-bar">
            {view.kind === "unavailable" && <span className="account-unavailable">Sign-in is unavailable</span>}

            {view.kind === "signed_out" && (
                <button type="button" className="account-button" onClick={account.signIn}>
                    Sign in with Google
                </button>
            )}

            {view.kind === "signed_in" && (
                <button
                    type="button"
                    className="account-button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setIsOpen((open) => !open)}
                >
                    Signed in as {chooseDisplayName(view.name, view.preferredName)}
                </button>
            )}

            {message && (
                <p className="account-message" role="alert">
                    {message}
                </p>
            )}

            {view.kind === "signed_in" && isOpen && view.profile !== "loading" && (
                <ProfilePanel
                    account={account}
                    name={view.name}
                    email={view.email}
                    preferredName={view.preferredName}
                    isProfileReady={view.profile === "ready"}
                    panelId={panelId}
                />
            )}
        </div>
    )
}
