import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
    assertNoPlaywrightVariables,
    buildNpxCommandLine,
    findPlaywrightVariableNames,
} from "./playwrightMcpEnvironment.mjs"

describe("findPlaywrightVariableNames", () => {
    it("finds nothing in an environment without Playwright variables", () => {
        expect(
            findPlaywrightVariableNames({ PATH: "/usr/bin", PWD: "/home/someone", PW: "1", PLAYWRIGHT: "1" }),
        ).toEqual([])
    })

    it.each([
        // Loads saved cookies and localStorage into the browser.
        "PLAYWRIGHT_MCP_STORAGE_STATE",
        // Attach to a browser that is already running.
        "PLAYWRIGHT_MCP_CDP_ENDPOINT",
        "PLAYWRIGHT_MCP_CDP_HEADERS",
        "PLAYWRIGHT_MCP_EXTENSION",
        "PLAYWRIGHT_MCP_EXTENSION_TOKEN",
        "PLAYWRIGHT_MCP_REMOTE_HEADERS",
        // Read settings or secrets from another file.
        "PLAYWRIGHT_MCP_CONFIG",
        "PLAYWRIGHT_MCP_SECRETS_FILE",
        // Choose a profile or a browser.
        "PLAYWRIGHT_MCP_USER_DATA_DIR",
        "PLAYWRIGHT_MCP_PROFILE_DIR_NAME",
        "PLAYWRIGHT_MCP_EXECUTABLE_PATH",
        "PLAYWRIGHT_MCP_BROWSER",
        "PLAYWRIGHT_MCP_ISOLATED",
        // Run a script or open a page before the checks start.
        "PLAYWRIGHT_MCP_INIT_SCRIPT",
        "PLAYWRIGHT_MCP_INIT_PAGE",
        // Change what the browser may reach or do.
        "PLAYWRIGHT_MCP_ALLOWED_ORIGINS",
        "PLAYWRIGHT_MCP_BLOCKED_ORIGINS",
        "PLAYWRIGHT_MCP_PROXY_SERVER",
        "PLAYWRIGHT_MCP_PROXY_BYPASS",
        "PLAYWRIGHT_MCP_IGNORE_HTTPS_ERRORS",
        "PLAYWRIGHT_MCP_GRANT_PERMISSIONS",
        "PLAYWRIGHT_MCP_ALLOW_UNRESTRICTED_FILE_ACCESS",
        "PLAYWRIGHT_MCP_BLOCK_SERVICE_WORKERS",
        "PLAYWRIGHT_MCP_CAPS",
        "PLAYWRIGHT_MCP_OUTPUT_DIR",
        // A setting a later version might add.
        "PLAYWRIGHT_MCP_SOMETHING_NEW",
        // Other Playwright variables, some of which choose a profile or attach to a browser.
        "PLAYWRIGHT_BROWSERS_PATH",
        "PW_CHROMIUM_ATTACH_TO_OTHER",
        "PW_EXTENSION_MODE",
        "PWTEST_EXTENSION_USER_DATA_DIR",
        "PWTEST_PROFILE_DIR",
        "PWMCP_PROFILES_DIR_FOR_TEST",
        "PWDEBUG",
        "PWDEBUGIMPL",
    ])("finds %s", (name) => {
        expect(findPlaywrightVariableNames({ PATH: "/usr/bin", [name]: "synthetic" })).toEqual([name])
    })

    it("matches names whatever their case, as Windows does", () => {
        expect(findPlaywrightVariableNames({ playwright_mcp_config: "synthetic", Pw_Lang_Name: "python" })).toEqual([
            "Pw_Lang_Name",
            "playwright_mcp_config",
        ])
    })

    it("counts a variable that is set but empty", () => {
        expect(
            findPlaywrightVariableNames({ PLAYWRIGHT_MCP_STORAGE_STATE: "", PLAYWRIGHT_MCP_CONFIG: undefined }),
        ).toEqual(["PLAYWRIGHT_MCP_CONFIG", "PLAYWRIGHT_MCP_STORAGE_STATE"])
    })
})

describe("assertNoPlaywrightVariables", () => {
    it("accepts an environment without Playwright variables", () => {
        expect(() => assertNoPlaywrightVariables({ PATH: "/usr/bin" })).not.toThrow()
    })

    it("refuses an environment with a Playwright variable, naming it without its value", () => {
        const refuse = () =>
            assertNoPlaywrightVariables({
                PLAYWRIGHT_MCP_SECRETS_FILE: "synthetic-secrets-path",
                PLAYWRIGHT_MCP_STORAGE_STATE: "synthetic-state-path",
                PATH: "/usr/bin",
            })

        expect(refuse).toThrow(/PLAYWRIGHT_MCP_SECRETS_FILE, PLAYWRIGHT_MCP_STORAGE_STATE/)
        expect(refuse).not.toThrow(/synthetic-secrets-path|synthetic-state-path/)
    })
})

describe("buildNpxCommandLine", () => {
    it("joins plain arguments after npx", () => {
        expect(buildNpxCommandLine(["-y", "@playwright/mcp@0.0.83", "--allowed-origins", "http://127.0.0.1:5183"])).toBe(
            "npx -y @playwright/mcp@0.0.83 --allowed-origins http://127.0.0.1:5183",
        )
    })

    it("refuses to run npx with no package", () => {
        expect(() => buildNpxCommandLine([])).toThrow(/no package/)
    })

    it.each(["", "two words", "a&b", "a|b", "a;b", "$(a)", "`a`", "%PATH%", "a>b", '"a"', "a\nb"])(
        "refuses the argument %j, which a shell could read as more than text",
        (argument) => {
            expect(() => buildNpxCommandLine(["-y", argument])).toThrow(/not plain text/)
        },
    )
})

describe(".mcp.json", () => {
    const { command, args } = (
        JSON.parse(readFileSync(new URL("../.mcp.json", import.meta.url), "utf8")) as {
            mcpServers: { playwright: { command: string; args: string[] } }
        }
    ).mcpServers.playwright

    it("starts Playwright MCP through the launcher that checks the environment", () => {
        expect(command).toBe("node")
        expect(args[0]).toBe("server/startPlaywrightMcp.mjs")
    })

    it("passes the launcher arguments it accepts, naming the version and the isolation options", () => {
        const commandLine = buildNpxCommandLine(args.slice(1))

        expect(commandLine).toContain(" @playwright/mcp@0.0.83 ")
        expect(commandLine).toContain(" --isolated ")
        expect(commandLine).toContain(" --allowed-origins http://127.0.0.1:5183 ")
    })
})
