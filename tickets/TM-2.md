# TM-2 — Reduce unnecessary Codex approval prompts

## User problem

Repeated approval prompts interrupt routine project validation by Codex. We want
to reduce these interruptions while preserving control over operations that need
broader permissions.

## Requirements

- Allow Codex to run routine TaskManager test, lint and build validation without repeated approval prompts, including when execution outside the sandbox is needed.
- Maintain sandbox protection for normal operations.
- Continue requiring approval for commands that need execution outside the sandbox and are not explicitly trusted validation operations.
- Scope validation permissions to TaskManager without granting equivalent permissions to unrelated projects.
- Document the trusted validation operations and intended permission boundary so another developer or agent can understand them.

## Acceptance criteria

- Routine test, lint and build validation can run without repeated approval prompts.
- Other commands requiring execution outside the sandbox continue to require approval.
- The permission is scoped to TaskManager and does not grant equivalent permissions to unrelated projects.
- The configuration is documented sufficiently for another developer/agent to understand the intended permission boundary.
- The resulting behaviour is verified.
