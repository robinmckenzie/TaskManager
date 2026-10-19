import { handleHostedAccountRequest } from "../server/accountFunction.ts"

// vercel.json rewrites every path under /api/auth here, keeping the original
// address. The handler routes by path and refuses any Better Auth endpoint the
// app does not use. A catch-all file in api/auth/ would receive only
// one-segment paths on Vercel.
export default { fetch: handleHostedAccountRequest }
