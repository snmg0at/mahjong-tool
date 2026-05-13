# AGENTS instructions

- Before finishing any change, always iterate until the build passes.
- Minimum required verification before completion:
  - `npm run build`
  - `npm test`
- If either command fails, keep debugging and fixing until both commands pass.
- Do not stop after a single failed attempt; continue trial-and-error until passing.
- Never leave unresolved merge markers in any file:
  - `<<<<<<<`
  - `=======`
  - `>>>>>>>`
- If merge markers are found, resolve and remove them first, then rerun build/test.
