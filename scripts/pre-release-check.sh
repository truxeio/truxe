#!/bin/bash

# Truxe Pre-Release Verification Script
# Ensures everything is ready for production release

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Truxe Pre-Release Verification v0.5.0   ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""

# Track results
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNINGS=0

# Function to report check result
check_result() {
    local status=$1
    local message=$2
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

    if [ "$status" == "pass" ]; then
        echo -e "${GREEN}✅ PASS${NC} - $message"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    elif [ "$status" == "fail" ]; then
        echo -e "${RED}❌ FAIL${NC} - $message"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    elif [ "$status" == "warn" ]; then
        echo -e "${YELLOW}⚠️  WARN${NC} - $message"
        WARNINGS=$((WARNINGS + 1))
    fi
}

echo -e "${BLUE}1️⃣  Repository Status Checks${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if in git repo
if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    check_result "pass" "Inside git repository"
else
    check_result "fail" "Not in git repository"
    exit 1
fi

# Check current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" == "main" ]; then
    check_result "pass" "On main branch"
else
    check_result "warn" "Not on main branch (currently on: $CURRENT_BRANCH)"
fi

# Check working directory is clean
if git diff-index --quiet HEAD --; then
    check_result "pass" "Working directory is clean"
else
    check_result "fail" "Working directory has uncommitted changes"
    echo -e "${YELLOW}   Run: git status${NC}"
fi

# Check for untracked files
UNTRACKED=$(git ls-files --others --exclude-standard | wc -l | tr -d ' ')
if [ "$UNTRACKED" -eq 0 ]; then
    check_result "pass" "No untracked files"
else
    check_result "warn" "$UNTRACKED untracked files present"
fi

# Check if ahead/behind remote
git fetch origin > /dev/null 2>&1
LOCAL_COMMIT=$(git rev-parse HEAD)
REMOTE_COMMIT=$(git rev-parse origin/main)

if [ "$LOCAL_COMMIT" == "$REMOTE_COMMIT" ]; then
    check_result "pass" "In sync with origin/main"
else
    AHEAD=$(git rev-list --count origin/main..HEAD)
    BEHIND=$(git rev-list --count HEAD..origin/main)
    if [ "$AHEAD" -gt 0 ]; then
        check_result "warn" "$AHEAD commits ahead of origin/main (will be pushed)"
    fi
    if [ "$BEHIND" -gt 0 ]; then
        check_result "fail" "$BEHIND commits behind origin/main (need to pull)"
    fi
fi

echo ""
echo -e "${BLUE}2️⃣  Package Integrity Checks${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if pnpm is installed
if command -v pnpm > /dev/null 2>&1; then
    check_result "pass" "pnpm is installed ($(pnpm --version))"
else
    check_result "fail" "pnpm is not installed"
    exit 1
fi

# Check package.json exists
if [ -f "package.json" ]; then
    check_result "pass" "Root package.json exists"
else
    check_result "fail" "Root package.json not found"
    exit 1
fi

# Verify workspace packages
EXPECTED_PACKAGES=("@truxe/react" "@truxe/cli" "@truxe/playground" "@truxe/website")
for pkg in "${EXPECTED_PACKAGES[@]}"; do
    if pnpm list --depth 0 | grep -q "$pkg"; then
        check_result "pass" "Package $pkg exists"
    else
        check_result "fail" "Package $pkg not found"
    fi
done

# Check for lockfile
if [ -f "pnpm-lock.yaml" ]; then
    check_result "pass" "pnpm-lock.yaml exists"
else
    check_result "fail" "pnpm-lock.yaml not found"
fi

echo ""
echo -e "${BLUE}3️⃣  Build Verification${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Clean build directories
echo -e "${YELLOW}   Cleaning previous builds...${NC}"
rm -rf packages/*/dist packages/*/build

# Build all packages
echo -e "${YELLOW}   Building all packages...${NC}"
if pnpm build > /tmp/truxe-build.log 2>&1; then
    check_result "pass" "All packages build successfully"
else
    check_result "fail" "Build failed (check /tmp/truxe-build.log)"
    cat /tmp/truxe-build.log
fi

# Check specific package builds
for pkg in react cli playground; do
    if [ -d "packages/$pkg/dist" ] || [ -d "packages/$pkg/build" ]; then
        check_result "pass" "@truxe/$pkg dist files created"
    else
        check_result "fail" "@truxe/$pkg dist files not found"
    fi
done

echo ""
echo -e "${BLUE}4️⃣  TypeScript Compilation${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Type check all packages
echo -e "${YELLOW}   Running TypeScript type checks...${NC}"
if pnpm type-check > /tmp/truxe-typecheck.log 2>&1; then
    check_result "pass" "Zero TypeScript errors"
else
    check_result "fail" "TypeScript errors found"
    echo -e "${YELLOW}   First 20 errors:${NC}"
    head -20 /tmp/truxe-typecheck.log
fi

echo ""
echo -e "${BLUE}5️⃣  Test Suite${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Run tests
echo -e "${YELLOW}   Running test suite...${NC}"
if pnpm test > /tmp/truxe-test.log 2>&1; then
    check_result "pass" "All tests passing"

    # Extract test counts
    TEST_COUNT=$(grep -oE "[0-9]+ passing" /tmp/truxe-test.log | head -1 || echo "0 passing")
    echo -e "${GREEN}      Tests: $TEST_COUNT${NC}"
else
    check_result "fail" "Tests failed"
    tail -30 /tmp/truxe-test.log
fi

echo ""
echo -e "${BLUE}6️⃣  Dependency Audit${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Security audit
echo -e "${YELLOW}   Running npm audit...${NC}"
AUDIT_OUTPUT=$(npm audit --audit-level=moderate 2>&1 || true)

if echo "$AUDIT_OUTPUT" | grep -q "found 0 vulnerabilities"; then
    check_result "pass" "No vulnerabilities found"
elif echo "$AUDIT_OUTPUT" | grep -q "found.*low"; then
    VULN_COUNT=$(echo "$AUDIT_OUTPUT" | grep -oE "[0-9]+ low" | head -1)
    check_result "warn" "Low severity vulnerabilities: $VULN_COUNT"
elif echo "$AUDIT_OUTPUT" | grep -q "found.*moderate\|high\|critical"; then
    check_result "fail" "Security vulnerabilities found"
    echo "$AUDIT_OUTPUT"
else
    check_result "pass" "No moderate+ vulnerabilities"
fi

echo ""
echo -e "${BLUE}7️⃣  URL Verification${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check for private repo URLs
PRIVATE_URLS=$(grep -r "github.com/Wundam/truxe" --include="*.json" --include="*.md" --include="*.ts" --include="*.tsx" packages/ 2>/dev/null | wc -l | tr -d ' ')
if [ "$PRIVATE_URLS" -eq 0 ]; then
    check_result "pass" "No private repo URLs found"
else
    check_result "fail" "$PRIVATE_URLS files contain private repo URLs"
    echo -e "${YELLOW}   Files with private URLs:${NC}"
    grep -r "github.com/Wundam/truxe" --include="*.json" --include="*.md" --include="*.ts" --include="*.tsx" packages/ 2>/dev/null | head -5
fi

# Check for correct public URLs
PUBLIC_URLS=$(grep -r "github.com/truxeio/truxe" --include="*.json" --include="*.md" packages/ 2>/dev/null | wc -l | tr -d ' ')
if [ "$PUBLIC_URLS" -gt 0 ]; then
    check_result "pass" "Public repo URLs found: $PUBLIC_URLS files"
else
    check_result "warn" "No public repo URLs found (expected in package.json files)"
fi

echo ""
echo -e "${BLUE}8️⃣  Playground-Specific Checks${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check playground dist size
if [ -d "packages/playground/dist" ]; then
    DIST_SIZE=$(du -sh packages/playground/dist | awk '{print $1}')
    check_result "pass" "Playground build size: $DIST_SIZE"

    # Check for large files
    LARGE_FILES=$(find packages/playground/dist -type f -size +1M | wc -l | tr -d ' ')
    if [ "$LARGE_FILES" -gt 0 ]; then
        check_result "warn" "$LARGE_FILES files > 1MB in playground dist"
    else
        check_result "pass" "No oversized files in playground dist"
    fi
else
    check_result "fail" "Playground dist directory not found"
fi

# Check for required playground files
REQUIRED_FILES=("index.html" "assets")
for file in "${REQUIRED_FILES[@]}"; do
    if [ -e "packages/playground/dist/$file" ]; then
        check_result "pass" "Playground has $file"
    else
        check_result "fail" "Playground missing $file"
    fi
done

echo ""
echo -e "${BLUE}9️⃣  Version Consistency${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Get versions
ROOT_VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "unknown")
REACT_VERSION=$(node -p "require('./packages/react/package.json').version" 2>/dev/null || echo "unknown")
CLI_VERSION=$(node -p "require('./packages/cli/package.json').version" 2>/dev/null || echo "unknown")
PLAYGROUND_VERSION=$(node -p "require('./packages/playground/package.json').version" 2>/dev/null || echo "unknown")

echo -e "   Root:       ${ROOT_VERSION}"
echo -e "   React:      ${REACT_VERSION}"
echo -e "   CLI:        ${CLI_VERSION}"
echo -e "   Playground: ${PLAYGROUND_VERSION}"

# Check if playground is v0.5.0
if [ "$PLAYGROUND_VERSION" == "0.5.0" ]; then
    check_result "pass" "Playground version is 0.5.0"
else
    check_result "warn" "Playground version is $PLAYGROUND_VERSION (expected 0.5.0)"
fi

echo ""
echo -e "${BLUE}🔟  Documentation Checks${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check required docs exist
REQUIRED_DOCS=("README.md" "CHANGELOG.md" "CONTRIBUTING.md" "LICENSE")
for doc in "${REQUIRED_DOCS[@]}"; do
    if [ -f "$doc" ]; then
        check_result "pass" "$doc exists"
    else
        check_result "fail" "$doc not found"
    fi
done

# Check CHANGELOG has v0.5.0
if grep -q "0.5.0" CHANGELOG.md; then
    check_result "pass" "CHANGELOG.md mentions v0.5.0"
else
    check_result "warn" "CHANGELOG.md doesn't mention v0.5.0"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           Verification Summary            ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""

echo -e "Total Checks:   ${TOTAL_CHECKS}"
echo -e "Passed:         ${GREEN}${PASSED_CHECKS}${NC}"
echo -e "Failed:         ${RED}${FAILED_CHECKS}${NC}"
echo -e "Warnings:       ${YELLOW}${WARNINGS}${NC}"

echo ""

if [ "$FAILED_CHECKS" -eq 0 ]; then
    echo -e "${GREEN}╔═══════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✅ READY FOR RELEASE!                    ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo -e "1. git tag -a v0.5.0 -m 'Release v0.5.0'"
    echo -e "2. git push origin main v0.5.0"
    echo -e "3. git push public main v0.5.0"
    echo -e "4. gh release create v0.5.0"
    exit 0
else
    echo -e "${RED}╔═══════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  ❌ NOT READY FOR RELEASE                 ║${NC}"
    echo -e "${RED}╚═══════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}Please fix the failed checks before releasing.${NC}"
    exit 1
fi
