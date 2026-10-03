import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it, vi } from "vitest"
import App from "./App"
import * as userHelpers from "./users"

it("shares the sorted user options with every task dropdown", () => {
    const roster = Object.freeze([
        { id: "1", name: "Zoe", photo: "" },
        { id: "2", name: "Amy", photo: "" },
        { id: "3", name: "Ben", photo: "" },
    ])
    const sorted = userHelpers.sortAssigneesByName(roster)
    const sort = vi.spyOn(userHelpers, "sortAssigneesByName").mockReturnValue(sorted)
    vi.stubGlobal("localStorage", { getItem: () => null })
    try {
        const markup = renderToStaticMarkup(createElement(App))
        const dropdowns = [...markup.matchAll(/<select[^>]*>([\s\S]*?)<\/select>/g)]
            .map((select) => [...select[1].matchAll(/<option[^>]*>([^<]*)<\/option>/g)]
                .map((option) => option[1]))
        expect(dropdowns[0]).toEqual(["All assignees", "Amy", "Ben", "Zoe"])
        expect(dropdowns).toHaveLength(5)
        for (const options of dropdowns.slice(1)) {
            expect(options).toEqual(["Amy", "Ben", "Zoe"])
        }
        expect(sort).toHaveBeenCalledTimes(1)
        expect(userHelpers.getNewTaskAssignee("", roster)).toBe("1")
        expect(roster.map((user) => user.name)).toEqual(["Zoe", "Amy", "Ben"])
    } finally {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    }
})

it("renders All assignees before alphabetical user options in the filter", () => {
    vi.stubGlobal("localStorage", { getItem: () => null })
    try {
        const markup = renderToStaticMarkup(createElement(App))
        const filter = markup.match(/<label class="assignee-filter">[\s\S]*?<\/label>/)?.[0]
        expect(filter).toBeDefined()
        const options = [...filter!.matchAll(/<option[^>]*>([^<]*)<\/option>/g)]
            .map((match) => match[1])
        expect(options).toEqual(["All assignees", "Aaron", "Alice", "Bob", "Charlie"])
    } finally {
        vi.unstubAllGlobals()
    }
})
