# Artifacts Directory

This directory contains build artifacts, test results, SBOM, signatures, and deployment metadata.

## Directory Structure

```
.artifacts/
├── dist/           # Build outputs (.next, compiled assets)
├── test/           # Test results and coverage
├── sbom/           # Software Bill of Materials (SBOM) and vulnerability reports
├── signing/        # Signed artifacts and signature bundles
├── release/        # Release notes, changelogs, deployment URLs
└── local/          # Local development artifacts (gitignored)
```

## Purpose

The `.artifacts/` directory serves as the single source of truth for all build and deployment artifacts, ensuring:

1. **Reproducibility**: Same inputs produce same outputs
2. **Auditability**: Complete trail of what was built, tested, and deployed
3. **Traceability**: Link artifacts to commits, PRs, and deployments

## Usage

### During Development

```bash
# Run full build pipeline locally
./ops/runbook.sh all local

# Check artifacts
ls -la .artifacts/
```

### In CI/CD

```bash
# CI pipeline runs
./ops/runbook.sh all ci

# Artifacts are uploaded to GitHub Actions Artifacts
```

### Release Process

```bash
# Build and sign for production
./ops/runbook.sh all prod

# Artifacts in .artifacts/release/ include:
# - Release notes
# - SBOM
# - Signed build archive
# - Deployment URLs
```

## Artifact Retention

- **Local**: Not committed to git (in `.gitignore`)
- **CI**: Retained for 7 days in GitHub Actions
- **Staging**: Retained for 30 days
- **Production**: Retained indefinitely with backup

## Security

- Signatures are created with Sigstore (keyless signing)
- SBOM includes full dependency tree
- Vulnerability scans block deployments with critical CVEs
- All artifacts are checksummed

## Maintenance

Clean up local artifacts:

```bash
rm -rf .artifacts/local/*
```

## See Also

- `/ops/runbook.sh` - Automated build and deployment script
- `/ops/run.json` - Configuration for different environments
- `/ops/atlas-tasks.md` - Manual UI tasks (when API is not available)
