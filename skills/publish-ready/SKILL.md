---
name: publish-ready
description: Audit and optimize a local repository to prepare it for public open-source distribution. Use when the user wants to publish the codebase, cleanup before open-sourcing, review for community standards, sanitize paths and secrets, or when triggers include "clean up repo", "preparar repo", "publico", "open source", "publish ready", "otimiza comunidade", "clean for community".
---

# Publish Ready

Act as a skeptical external open-source developer arriving cold to inspect this repository before it is released to the public. Your job is to enforce absolute portability, security, and professional packaging.

Verdict is binary: **READY TO PUBLISH** or **NEEDS CLEANUP**.

---

## Process Loop

When triggered, you must execute these four steps in order:

### 1. Diagnostic Scan
Do not guess. Programmatically scan the workspace using the following commands:
- **Paths Audit**: Run `grep -rn "/home/" --exclude-dir=node_modules --exclude-dir=.git .` to find hardcoded user paths.
- **Secrets Audit**: Run `grep -rn "API_KEY\|SECRET\|TOKEN\|PASSWORD\|CREDENTIALS" --exclude-dir=node_modules --exclude-dir=.git .` to locate credentials.
- **Packaging Audit**: Check for `LICENSE`, `README.md`, `package.json`, `tsconfig.json`, `.gitignore`, `CHANGELOG.md`, and `CONTRIBUTING.md`.
- **Version Audit**: Compare the version field in `package.json` and `package-lock.json` and ensure they match. Check if `CHANGELOG.md` contains the version string.

### 2. Evaluate Quality Lenses

- **L1: Environment Hygiene (Blocking)** — Zero absolute paths (`/home/...`), zero system-specific usernames, and zero credentials checked into source control or configuration files.
- **L2: Distribution Standards (Blocking)** — A valid `LICENSE` exists. `package.json` contains valid description, author, repository URL, bugs, and homepage metadata.
- **L3: Build Integrity (Warning)** — TypeScript checks compile strictly (`tsconfig.json` lacks `allowJs` or `checkJs` bypasses), tests pass cleanly, and `.gitignore` covers local run files.
- **L4: Onboarding Portability (Warning)** — Setup steps are machine-agnostic. No references to internal servers or local dev environments.
- **L5: Release & Versioning Hygiene (Blocking/Warning)** — The version field follows SemVer. `package.json` version matches `package-lock.json` exactly. `CHANGELOG.md` contains release notes matching the current version.
- **L6: Community Packaging (Warning)** — `CONTRIBUTING.md` is present. `package.json` contains a `"files"` declaration defining the whitelist of distributed files.

### 3. Generate Report
Print a concise diagnostic report using this exact format (no introductory prose):

```
/publish-ready · <current-date>

Verdict: [READY TO PUBLISH / NEEDS CLEANUP]
─────────────────────────────────────────

BLOCKING
  [L1] <file:line> — Description of leakage or hardcoded paths.
  [L2] <file> — Missing license or essential package metadata.
  [L5] <file> — Version mismatch or invalid SemVer structure.

WARNING
  [L3] <file> — Build warnings, test failures, or loose compiler options.
  [L5] <file> — Missing changelog file or release notes for current version.
  [L6] <file> — Missing contributing guide or package files whitelist.

No issues: L1, L2, L3, L4, L5, L6
```

### 4. Remediate
For any identified issues:
1. Propose specific, generic drop-in replacements.
2. Ask the user for confirmation: `Apply fixes? all · select · cancel`.
3. Apply changes, and then run `npm run typecheck && npm test` to ensure stability.
