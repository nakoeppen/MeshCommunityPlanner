# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Mesh Community Planner, please report it responsibly.

**Do not** open a public GitHub issue for security vulnerabilities.

Instead, please report vulnerabilities by opening a [private security advisory](https://github.com/PapaSierra555/MeshCommunityPlanner/security/advisories/new) on GitHub.

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## Response Timeline

- **Acknowledgment:** Within 48 hours of report
- **Assessment:** Within 1 week
- **Fix:** Depends on severity — critical issues are prioritized

## Scope

This policy covers the Mesh Community Planner application code in this repository.

**In scope:**
- Application backend (Python/FastAPI)
- Application frontend (React/TypeScript)
- Build and packaging scripts
- Default configuration

**Out of scope:**
- Third-party dependencies (report to their maintainers)
- Self-hosted infrastructure or deployment issues
- Social engineering

## Architecture Notes

Mesh Community Planner is a **local desktop application**:

- The server binds to `127.0.0.1` only (not exposed to network)
- No user accounts or authentication (single-user local app)
- All data stored locally in SQLite
- No telemetry or external data collection
- External requests (map tiles, terrain data) are fetched on demand

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | Yes       |
| < 1.0   | No        |
