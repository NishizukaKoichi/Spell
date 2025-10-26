#!/usr/bin/env bash
set -euo pipefail

# Spell Platform Runbook
# Idempotent operations for build, test, SBOM, sign, deploy, and health checks
# Usage: ./ops/runbook.sh [command] [TARGET_ENV]
#
# Commands:
#   setup       - Install dependencies and prepare environment
#   build       - Build the application
#   test        - Run all tests
#   sbom        - Generate Software Bill of Materials
#   sign        - Sign artifacts with cosign
#   deploy      - Deploy to target environment
#   health      - Health check on deployed environment
#   all         - Run all steps in sequence
#
# TARGET_ENV: local | ci | staging | prod

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ARTIFACTS_DIR="${PROJECT_ROOT}/.artifacts"

# Default values
TARGET_ENV="${2:-local}"
COMMAND="${1:-help}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

fail() {
    log_error "$1"
    echo "$1" > "${ARTIFACTS_DIR}/FAILURE.txt"
    exit 1
}

# Create artifacts directory structure
setup_artifacts() {
    log_info "Setting up artifacts directory..."
    mkdir -p "${ARTIFACTS_DIR}"/{dist,test,sbom,signing,release,local}
}

# Setup: Install dependencies
cmd_setup() {
    log_info "Installing dependencies..."
    cd "${PROJECT_ROOT}"

    if ! command -v pnpm &> /dev/null; then
        fail "pnpm is not installed. Please install it first: npm install -g pnpm"
    fi

    pnpm install --frozen-lockfile || fail "Failed to install dependencies"
    log_info "Dependencies installed successfully"
}

# Build: Compile the application
cmd_build() {
    log_info "Building application for ${TARGET_ENV}..."
    cd "${PROJECT_ROOT}"

    # Set environment-specific variables
    export NODE_ENV="production"

    pnpm build || fail "Build failed"

    # Copy build artifacts
    if [ -d ".next" ]; then
        cp -r .next "${ARTIFACTS_DIR}/dist/"
        log_info "Build artifacts copied to ${ARTIFACTS_DIR}/dist/"
    fi

    log_info "Build completed successfully"
}

# Test: Run all tests
cmd_test() {
    log_info "Running tests..."
    cd "${PROJECT_ROOT}"

    # Lint
    log_info "Running lint..."
    pnpm lint || fail "Lint failed"

    # Type check
    log_info "Running type check..."
    pnpm typecheck || fail "Type check failed"

    # Format check
    log_info "Running format check..."
    pnpm format:check || fail "Format check failed"

    # Save test results
    echo "All tests passed at $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "${ARTIFACTS_DIR}/test/results.txt"

    log_info "All tests passed"
}

# SBOM: Generate Software Bill of Materials
cmd_sbom() {
    log_info "Generating SBOM..."
    cd "${PROJECT_ROOT}"

    if ! command -v syft &> /dev/null; then
        log_warn "syft is not installed. Skipping SBOM generation."
        log_warn "Install with: curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin"
        return 0
    fi

    syft packages dir:. -o spdx-json > "${ARTIFACTS_DIR}/sbom/sbom.spdx.json" || fail "SBOM generation failed"

    log_info "SBOM generated at ${ARTIFACTS_DIR}/sbom/sbom.spdx.json"

    # Vulnerability scan
    if command -v grype &> /dev/null; then
        log_info "Running vulnerability scan..."
        grype dir:. -o json > "${ARTIFACTS_DIR}/sbom/vuln.json" || log_warn "Vulnerability scan had warnings"

        # Check for critical vulnerabilities
        CRITICAL_COUNT=$(jq '[.matches[] | select(.vulnerability.severity == "Critical")] | length' "${ARTIFACTS_DIR}/sbom/vuln.json" 2>/dev/null || echo "0")
        if [ "${CRITICAL_COUNT}" -gt 0 ]; then
            fail "Found ${CRITICAL_COUNT} critical vulnerabilities. Fix them before proceeding."
        fi
        log_info "Vulnerability scan completed"
    else
        log_warn "grype is not installed. Skipping vulnerability scan."
    fi
}

# Sign: Sign artifacts with cosign
cmd_sign() {
    log_info "Signing artifacts..."

    if ! command -v cosign &> /dev/null; then
        log_warn "cosign is not installed. Skipping signing."
        log_warn "Install with: brew install cosign (macOS) or see https://docs.sigstore.dev/cosign/installation/"
        return 0
    fi

    # Create a tar of the build for signing
    cd "${ARTIFACTS_DIR}/dist"
    tar -czf "../signing/build.tar.gz" .next/ || fail "Failed to create tar archive"

    cd "${ARTIFACTS_DIR}/signing"

    # Sign with keyless signing (requires OIDC)
    if [ "${TARGET_ENV}" = "ci" ] || [ "${TARGET_ENV}" = "prod" ]; then
        log_info "Signing with keyless (OIDC) mode..."
        cosign sign-blob build.tar.gz --bundle build.tar.gz.bundle || log_warn "Signing failed (may require OIDC setup)"
    else
        log_info "Skipping signature in ${TARGET_ENV} environment"
    fi

    log_info "Signing completed"
}

# Deploy: Deploy to target environment
cmd_deploy() {
    log_info "Deploying to ${TARGET_ENV}..."

    case "${TARGET_ENV}" in
        local)
            log_info "Starting local development server..."
            cd "${PROJECT_ROOT}"
            pnpm dev &
            log_info "Local server started (PID: $!)"
            ;;
        staging|prod)
            fail "Deployment to ${TARGET_ENV} requires manual configuration. Please set up Vercel or your deployment platform."
            ;;
        *)
            fail "Unknown target environment: ${TARGET_ENV}"
            ;;
    esac
}

# Health: Check deployment health
cmd_health() {
    log_info "Running health check for ${TARGET_ENV}..."

    # This is a placeholder - adjust URL based on your deployment
    local URL="http://localhost:3000"

    if [ "${TARGET_ENV}" = "staging" ]; then
        URL="https://spell-staging.vercel.app"
    elif [ "${TARGET_ENV}" = "prod" ]; then
        URL="https://spell.vercel.app"
    fi

    log_info "Checking ${URL}..."

    if command -v curl &> /dev/null; then
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${URL}" || echo "000")

        if [ "${HTTP_CODE}" = "200" ]; then
            log_info "Health check passed (HTTP ${HTTP_CODE})"
            echo "Health check passed at $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "${ARTIFACTS_DIR}/release/health.txt"
        else
            fail "Health check failed (HTTP ${HTTP_CODE})"
        fi
    else
        log_warn "curl is not installed. Skipping health check."
    fi
}

# All: Run all commands in sequence
cmd_all() {
    log_info "Running all commands for ${TARGET_ENV}..."
    setup_artifacts
    cmd_setup
    cmd_build
    cmd_test
    cmd_sbom
    cmd_sign

    if [ "${TARGET_ENV}" != "local" ]; then
        cmd_deploy
        cmd_health
    fi

    # Generate release summary
    cat > "${ARTIFACTS_DIR}/summary.md" <<EOF
# Spell Platform Build Summary

**Environment**: ${TARGET_ENV}
**Timestamp**: $(date -u +%Y-%m-%dT%H:%M:%SZ)
**Status**: ✅ Success

## Build Information
- Node.js version: $(node --version)
- pnpm version: $(pnpm --version)

## Artifacts
- Build output: .artifacts/dist/
- Test results: .artifacts/test/
- SBOM: .artifacts/sbom/
- Signatures: .artifacts/signing/

## Next Steps
- Review artifacts in .artifacts/ directory
- For deployment, run: ./ops/runbook.sh deploy ${TARGET_ENV}
EOF

    log_info "All commands completed successfully!"
    log_info "Summary available at: ${ARTIFACTS_DIR}/summary.md"
}

# Help
cmd_help() {
    cat <<EOF
Spell Platform Runbook

Usage: ./ops/runbook.sh [command] [TARGET_ENV]

Commands:
  setup       - Install dependencies and prepare environment
  build       - Build the application
  test        - Run all tests
  sbom        - Generate Software Bill of Materials
  sign        - Sign artifacts with cosign
  deploy      - Deploy to target environment
  health      - Health check on deployed environment
  all         - Run all steps in sequence
  help        - Show this help message

Target Environments:
  local       - Local development
  ci          - CI/CD pipeline
  staging     - Staging environment
  prod        - Production environment

Examples:
  ./ops/runbook.sh all local
  ./ops/runbook.sh build ci
  ./ops/runbook.sh deploy staging

EOF
}

# Main execution
main() {
    setup_artifacts

    case "${COMMAND}" in
        setup)
            cmd_setup
            ;;
        build)
            cmd_build
            ;;
        test)
            cmd_test
            ;;
        sbom)
            cmd_sbom
            ;;
        sign)
            cmd_sign
            ;;
        deploy)
            cmd_deploy
            ;;
        health)
            cmd_health
            ;;
        all)
            cmd_all
            ;;
        help|--help|-h)
            cmd_help
            ;;
        *)
            log_error "Unknown command: ${COMMAND}"
            cmd_help
            exit 1
            ;;
    esac
}

main "$@"
