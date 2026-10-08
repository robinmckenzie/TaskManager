import { mergeConfig } from 'vite'
import baseConfig from './vite.config.ts'
import { assertEnvironmentIsIsolated } from './server/browserCheckEnvironment.ts'

// The server that browser checks run against: `npm run dev:browser-check`.
// It serves the same app as `npm run dev`, but with no credentials. This check
// runs while the configuration loads, so a refusal happens before anything
// listens on the port.
assertEnvironmentIsIsolated(process.env)

export default mergeConfig(baseConfig, {
  // Load no .env files, so the Speechmatics key in .env.local is never read.
  envDir: false,
  server: {
    // Its own address, so it never shares a port, or saved tasks, with the
    // usual development server. strictPort makes it fail instead of moving to
    // another port, which the browser would not be allowed to open.
    host: '127.0.0.1',
    port: 5183,
    strictPort: true,
  },
})
