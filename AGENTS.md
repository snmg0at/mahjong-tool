# AGENTS instructions

- Before finishing any change, always iterate until the build passes.
- Minimum required verification before completion:
  - `npm run build`
  - `npm test`
- If either command fails, keep debugging and fixing until both commands pass.
- Do not stop after a single failed attempt; continue trial-and-error until passing.

## Conflict prevention / recovery

- Keep PRs small: one theme per PR, and avoid changing the same file in multiple open PRs.
- Before opening or merging a PR, sync with latest `main` and resolve conflicts locally first.
- Never commit unresolved merge markers. Ensure these strings are absent from all tracked files:
  - `<<<<<<<`
  - `=======`
  - `>>>>>>>`
- If a conflict happens in a file with large edits, prefer replacing that file with the intended final version, then rerun build/tests.
