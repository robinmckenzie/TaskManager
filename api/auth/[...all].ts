import { handleHostedAccountRequest } from "../../server/accountFunction.ts"

// Vercel serves this file for every path under /api/auth. The handler routes
// by path and refuses any Better Auth endpoint the app does not use.
export default { fetch: handleHostedAccountRequest }
