/**
 * Guards the server that browser checks run against (see
 * `vite.browser-check.config.ts`). That server loads no environment files, so
 * the only way a production credential could reach it is through a variable
 * inherited from the shell that starts it.
 */

type Environment = Record<string, string | undefined>

/**
 * Names that could carry a production credential, or point the server at a
 * production service: the Speechmatics settings the dictation endpoints read,
 * database connection settings, and anything set by or for Vercel. A variable
 * counts whatever its value, so a value is never read.
 */
const CREDENTIAL_NAME_PATTERNS: readonly RegExp[] = [
    /^SPEECHMATICS_/i,
    /^DATABASE_/i,
    /^POSTGRES/i,
    /^PG(HOST|HOSTADDR|PORT|DATABASE|USER|PASSWORD|PASSFILE|SERVICE|SERVICEFILE|OPTIONS|SSLMODE|SSLCERT|SSLKEY)$/i,
    /^NEON_/i,
    /^VERCEL_/i,
]

export const findCredentialVariableNames = (env: Environment): string[] =>
    Object.keys(env)
        .filter((name) => CREDENTIAL_NAME_PATTERNS.some((pattern) => pattern.test(name)))
        .sort()

/**
 * Throws when the environment holds a variable that browser checks must not
 * run with. The message names the variables and never includes their values.
 */
export const assertEnvironmentIsIsolated = (env: Environment): void => {
    const names = findCredentialVariableNames(env)

    if (names.length > 0) {
        throw new Error(
            "The browser-check server was not started, because these environment variables are set: " +
                `${names.join(", ")}. Start it from a shell without them.`,
        )
    }
}
