#!/bin/bash

# Truxe Public Repository Sync Script
# Syncs commits from private (Wundam/truxe) to public (truxeio/truxe)
# Usage: ./scripts/sync-to-public.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Truxe Public Repository Sync Tool    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Check if we're in a git repository
if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Not in a git repository${NC}"
    exit 1
fi

# Check if we're on main branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${YELLOW}⚠️  Warning: Not on main branch (currently on: $CURRENT_BRANCH)${NC}"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}ℹ️  Aborted by user${NC}"
        exit 0
    fi
fi

# Check if working directory is clean
if ! git diff-index --quiet HEAD --; then
    echo -e "${RED}❌ Error: Working directory has uncommitted changes${NC}"
    echo -e "${YELLOW}   Please commit or stash your changes first${NC}"
    exit 1
fi

# Fetch latest from both remotes
echo -e "${BLUE}📥 Fetching latest from remotes...${NC}"
git fetch origin
git fetch public

# Check how many commits ahead of public
COMMITS_AHEAD=$(git rev-list --count public/main..HEAD)
if [ "$COMMITS_AHEAD" -eq 0 ]; then
    echo -e "${GREEN}✅ Already up to date with public repository${NC}"
    exit 0
fi

echo -e "${YELLOW}📊 Commits to sync: $COMMITS_AHEAD${NC}"
echo ""
echo -e "${BLUE}Recent commits:${NC}"
git log public/main..HEAD --oneline --max-count=10
echo ""

# Security check
echo -e "${BLUE}🔒 Running security checks...${NC}"

# Check for sensitive files
SENSITIVE_FILES=$(git diff public/main..HEAD --name-only | grep -E "\.(env|key|pem|p12|pfx)$" | grep -v -E "(\.env\.example|\.env\.template)" || true)
if [ -n "$SENSITIVE_FILES" ]; then
    echo -e "${RED}❌ Found potentially sensitive files:${NC}"
    echo "$SENSITIVE_FILES"
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}ℹ️  Aborted by user${NC}"
        exit 0
    fi
fi

# Check for hardcoded secrets
SENSITIVE_PATTERNS=$(git diff public/main..HEAD | grep -i "^\+.*" | grep -iE "(password|secret|private_key|api_key|token).*=.*['\"]" | grep -v -E "(PASSWORD|API_KEY|SECRET|JWT_SECRET|placeholder|example|test|mock)" || true)
if [ -n "$SENSITIVE_PATTERNS" ]; then
    echo -e "${YELLOW}⚠️  Found potential hardcoded secrets:${NC}"
    echo "$SENSITIVE_PATTERNS" | head -5
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}ℹ️  Aborted by user${NC}"
        exit 0
    fi
fi

echo -e "${GREEN}✅ Security checks passed${NC}"
echo ""

# Confirm sync
read -p "Push $COMMITS_AHEAD commits to public repository? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}ℹ️  Aborted by user${NC}"
    exit 0
fi

# Create dated sync branch
SYNC_BRANCH="public-sync-$(date +%Y%m%d)"
echo -e "${BLUE}🌿 Creating sync branch: $SYNC_BRANCH${NC}"
git checkout -b "$SYNC_BRANCH"

# Push to public
echo -e "${BLUE}📤 Pushing to public repository...${NC}"
if git push public "$SYNC_BRANCH:main"; then
    echo -e "${GREEN}✅ Successfully pushed to public repository${NC}"

    # Cleanup
    echo -e "${BLUE}🧹 Cleaning up...${NC}"
    git checkout main
    git branch -D "$SYNC_BRANCH"

    # Verify sync
    git fetch public
    LOCAL_COMMIT=$(git rev-parse HEAD)
    PUBLIC_COMMIT=$(git rev-parse public/main)

    if [ "$LOCAL_COMMIT" == "$PUBLIC_COMMIT" ]; then
        echo -e "${GREEN}✅ Verification passed - repositories are in sync${NC}"
    else
        echo -e "${YELLOW}⚠️  Warning: Commits don't match, please verify manually${NC}"
    fi

    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✅ Sync completed successfully!       ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}📊 Summary:${NC}"
    echo -e "   • Synced commits: $COMMITS_AHEAD"
    echo -e "   • Private repo: https://github.com/Wundam/truxe"
    echo -e "   • Public repo: https://github.com/truxeio/truxe"
else
    echo -e "${RED}❌ Failed to push to public repository${NC}"
    echo -e "${YELLOW}   Cleaning up sync branch...${NC}"
    git checkout main
    git branch -D "$SYNC_BRANCH"
    exit 1
fi
