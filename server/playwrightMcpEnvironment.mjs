/**
 * Guards the Playwright MCP server that browser checks use (see `.mcp.json`
 * and `startPlaywrightMcp.mjs`). The package reads its settings from inherited
 * environment variables as well as from its command line, and a command-line
 * option only wins for the setting it names. `--isolated` therefore does not
 * stop an inherited variable from loading saved cookies, attaching to a
 * browser that is already running, running a script in every page, or reading
 * another configuration or secrets file.
 *
 * This is plain JavaScript because it runs before anything is built, on every
 * supported version of Node.js.
 */

/**
 * Names the Playwright packages read: every `PLAYWRIGHT_MCP_` setting, and the
 * other Playwright prefixes, some of which also choose a profile or attach to
 * a browser. A variable counts whatever its value, so a value is never read.
 */
const PLAYWRIGHT_NAME_PATTERNS = [/^PLAYWRIGHT_/i, /^PW_/i, /^PWTEST_/i, /^PWMCP_/i, /^PWDEBUG/i]

/** An argument made only of these characters means the same to every shell, unquoted. */
const PLAIN_ARGUMENT = /^[\w@.:/-]+$/

/**
 * @param {Record<string, string | undefined>} env
 * @returns {string[]}
 */
export const findPlaywrightVariableNames = (env) =>
    Object.keys(env)
        .filter((name) => PLAYWRIGHT_NAME_PATTERNS.some((pattern) => pattern.test(name)))
        .sort()

/**
 * Throws when the environment holds a variable that could change how the
 * Playwright MCP server starts its browser. The message names the variables
 * and never includes their values.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {void}
 */
export const assertNoPlaywrightVariables = (env) => {
    const names = findPlaywrightVariableNames(env)

    if (names.length > 0) {
        throw new Error(
            "The Playwright MCP server was not started, because these environment variables are set: " +
                `${names.join(", ")}. Start Claude Code from a shell without them.`,
        )
    }
}

/**
 * Builds the command line that runs `npx` with the given arguments. It is run
 * through a shell, which Windows needs to start `npx`, so an argument that a
 * shell could read as anything but plain text is refused instead of quoted.
 *
 * @param {readonly string[]} npxArguments
 * @returns {string}
 */
export const buildNpxCommandLine = (npxArguments) => {
    if (npxArguments.length === 0) {
        throw new Error("The Playwright MCP server was not started, because no package was named.")
    }

    const unsafe = npxArguments.filter((argument) => !PLAIN_ARGUMENT.test(argument))

    if (unsafe.length > 0) {
        throw new Error(
            "The Playwright MCP server was not started, because these arguments are not plain text: " +
                `${unsafe.map((argument) => JSON.stringify(argument)).join(", ")}.`,
        )
    }

    return ["npx", ...npxArguments].join(" ")
}
