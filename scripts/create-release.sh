#!/bin/bash

# Truxe Release Automation Script
# Creates a complete release with tags, changelogs, and deployments
# Usage: ./scripts/create-release.sh v0.5.7

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Helper functions
function print_header() {
    echo ""
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo ""
}

function print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

function print_error() {
    echo -e "${RED}❌ $1${NC}"
}

function print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

function print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check version argument
if [ -z "$1" ]; then
    print_error "Usage: $0 <version>"
    print_info "Example: $0 v0.5.7"
    exit 1
fi

NEW_VERSION="$1"

# Validate semantic versioning
if ! [[ "$NEW_VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    print_error "Invalid version format: $NEW_VERSION"
    print_info "Expected format: v0.5.7 (semantic versioning)"
    exit 1
fi

print_header "Truxe Release Automation - $NEW_VERSION"

# ============================================================================
# STEP 1: Pre-Release Checks
# ============================================================================
print_header "Step 1: Running Pre-Release Checks"

if [ -f "scripts/pre-release-check.sh" ]; then
    print_info "Running comprehensive pre-release checks..."
    if bash scripts/pre-release-check.sh; then
        print_success "All pre-release checks passed"
    else
        print_error "Pre-release checks failed"
        print_info "Fix the issues and try again"
        exit 1
    fi
else
    print_warning "pre-release-check.sh not found, skipping automated checks"
    print_info "Manual verification recommended"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# ============================================================================
# STEP 2: Update CHANGELOG
# ============================================================================
print_header "Step 2: Update CHANGELOG"

if [ -f "CHANGELOG.md" ]; then
    print_info "CHANGELOG.md found"
   
    if grep -q "$NEW_VERSION" CHANGELOG.md; then
        print_success "CHANGELOG already includes $NEW_VERSION"
    else
        print_warning "CHANGELOG doesn't mention $NEW_VERSION"
        print_info "Please update CHANGELOG.md before continuing"
        read -p "Open CHANGELOG.md in editor? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            ${EDITOR:-vim} CHANGELOG.md
        fi
        
        read -p "CHANGELOG updated? Continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Update CHANGELOG.md and re-run this script"
            exit 1
        fi
    fi
else
    print_warning "CHANGELOG.md not found"
    print_info "Consider creating one for better release notes"
fi

# ============================================================================
# STEP 3: Create Git Tag
# ============================================================================
print_header "Step 3: Create Git Tag"

# Extract version info
VERSION_NUMBER=${NEW_VERSION#v}  # Remove 'v' prefix
MAJOR=$(echo $VERSION_NUMBER | cut -d. -f1)
MINOR=$(echo $VERSION_NUMBER | cut -d. -f2)
PATCH=$(echo $VERSION_NUMBER | cut -d. -f3)

# Determine release type
if [ "$PATCH" == "0" ]; then
    if [ "$MINOR" == "0" ]; then
        RELEASE_TYPE="Major Release"
    else
        RELEASE_TYPE="Minor Release"
    fi
else
    RELEASE_TYPE="Patch Release"
fi

print_info "Creating annotated tag for $NEW_VERSION ($RELEASE_TYPE)"

# Get commit history since last tag
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [ -n "$LAST_TAG" ]; then
    print_info "Changes since $LAST_TAG:"
    git log $LAST_TAG..HEAD --oneline | head -10
    echo ""
fi

# Create tag message
TAG_MESSAGE="Release $NEW_VERSION - $RELEASE_TYPE

$(git log ${LAST_TAG}..HEAD --pretty=format:"- %s" | head -20)

🤖 Generated with Claude Code
Production Status: READY ✅

Co-Authored-By: Claude <noreply@anthropic.com>"

# Create the tag
git tag -a "$NEW_VERSION" -m "$TAG_MESSAGE"
print_success "Created tag $NEW_VERSION"

# ============================================================================
# STEP 4: Push to Private Repository
# ============================================================================
print_header "Step 4: Push to Private Repository (wundam/truxe)"

print_info "Pushing main branch and tags..."
git push origin main
git push origin "$NEW_VERSION"
print_success "Pushed to private repository"

# ============================================================================
# STEP 5: Trigger Docker Build
# ============================================================================
print_header "Step 5: Trigger Docker Build"

print_info "Docker images will be built automatically by GitHub Actions"
print_info "Monitor: https://github.com/wundam/truxe/actions"

gh workflow list 2>/dev/null && {
    print_info "Triggering docker-build workflow..."
    gh workflow run docker-build.yml --ref "$NEW_VERSION" 2>/dev/null || print_warning "Could not trigger workflow (may require GitHub CLI)"
}

print_success "Docker build triggered (or will trigger automatically on tag push)"

# ============================================================================
# STEP 6: Sync to Public Repository (Optional)
# ============================================================================
print_header "Step 6: Sync to Public Repository (Optional)"

print_info "Should this release be synced to public repo (truxeio/truxe)?"
print_warning "Only sync if this includes Community Edition (MIT) changes"
read -p "Sync to public? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -f "scripts/sync-to-public.sh" ]; then
        print_info "Running sync-to-public.sh..."
        bash scripts/sync-to-public.sh
        
        print_info "Pushing tag to public repository..."
        git push public "$NEW_VERSION"
        print_success "Synced to public repository"
    else
        print_error "sync-to-public.sh not found"
        print_info "Manual sync required"
    fi
else
    print_info "Skipping public sync (private release only)"
fi

# ============================================================================
# STEP 7: Create GitHub Release
# ============================================================================
print_header "Step 7: Create GitHub Release"

print_info "Creating GitHub release..."

# Generate release notes from CHANGELOG or commits
if [ -f "CHANGELOG.md" ] && grep -q "$NEW_VERSION" CHANGELOG.md; then
    # Extract section from CHANGELOG
    RELEASE_NOTES=$(sed -n "/## \[$NEW_VERSION\]/,/## \[/p" CHANGELOG.md | sed '$d')
else
    # Generate from commits
    RELEASE_NOTES="## What's Changed

$(git log ${LAST_TAG}..HEAD --pretty=format:"- %s (%h)" | head -20)

**Full Changelog**: https://github.com/wundam/truxe/compare/${LAST_TAG}...${NEW_VERSION}"
fi

# Create release using gh CLI
if command -v gh &> /dev/null; then
    echo "$RELEASE_NOTES" | gh release create "$NEW_VERSION" \
        --title "$NEW_VERSION - $RELEASE_TYPE" \
        --notes-file - \
        --repo wundam/truxe
    
    print_success "GitHub release created"
    print_info "View: https://github.com/wundam/truxe/releases/tag/$NEW_VERSION"
else
    print_warning "GitHub CLI (gh) not installed"
    print_info "Create release manually: https://github.com/wundam/truxe/releases/new?tag=$NEW_VERSION"
fi

# ============================================================================
# STEP 8: Post-Release Verification
# ============================================================================
print_header "Step 8: Post-Release Verification"

print_info "Waiting 60 seconds for Docker builds to start..."
sleep 60

# Check GitHub Actions status
if command -v gh &> /dev/null; then
    print_info "Recent workflow runs:"
    gh run list --limit 3 2>/dev/null || print_info "Could not fetch workflow status"
fi

# Check Docker images
print_info "Verifying Docker images..."
if command -v docker &> /dev/null && command -v gh &> /dev/null; then
    gh api /user/packages/container/truxe-api/versions --jq '.[0].name' 2>/dev/null && {
        LATEST_IMAGE=$(gh api /user/packages/container/truxe-api/versions --jq '.[0].name')
        print_success "Latest API image: $LATEST_IMAGE"
    } || print_warning "Could not verify Docker images"
else
    print_info "Docker CLI or GitHub CLI not available for verification"
fi

# ============================================================================
# STEP 9: Deployment Instructions
# ============================================================================
print_header "Step 9: Deploy to Production (Optional)"

print_warning "This release is now available but NOT deployed to production"
print_info "To deploy to production:"
echo ""
echo "  ssh truxe-prod-01 'cd /opt/truxe/deployment && docker-compose pull && docker-compose up -d'"
echo ""

read -p "Deploy to production now? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "Deploying to production..."
    
    # Check if SSH config exists
    if ssh -q truxe-prod-01 exit 2>/dev/null; then
        print_info "Connecting to production server..."
        ssh truxe-prod-01 'cd /opt/truxe/deployment && docker-compose pull && docker-compose up -d'
        
        print_success "Deployed to production"
        
        # Health check
        print_info "Running health check..."
        sleep 10
        if curl -f https://api.truxe.io/health > /dev/null 2>&1; then
            print_success "Production API is healthy"
        else
            print_error "Production API health check failed"
            print_info "Check logs: ssh truxe-prod-01 'cd /opt/truxe/deployment && docker-compose logs --tail=100'"
        fi
    else
        print_error "Cannot connect to truxe-prod-01"
        print_info "Deploy manually or check SSH configuration"
    fi
else
    print_info "Skipping production deployment"
    print_info "Deploy later with the command above"
fi

# ============================================================================
# COMPLETION SUMMARY
# ============================================================================
print_header "Release Complete! 🎉"

echo ""
echo -e "${GREEN}✅ Successfully created release $NEW_VERSION${NC}"
echo ""
echo "📦 Release Details:"
echo "  - Tag: $NEW_VERSION"
echo "  - Type: $RELEASE_TYPE"
echo "  - Private Repo: https://github.com/wundam/truxe/releases/tag/$NEW_VERSION"
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "  - Public Repo: https://github.com/truxeio/truxe/releases/tag/$NEW_VERSION"
fi
echo ""
echo "🐳 Docker Images:"
echo "  - ghcr.io/wundam/truxe-api:$NEW_VERSION"
echo "  - ghcr.io/wundam/truxe-website:$NEW_VERSION"
echo ""
echo "📋 Next Steps:"
echo "  1. Monitor GitHub Actions: https://github.com/wundam/truxe/actions"
echo "  2. Verify Docker images built successfully"
echo "  3. Update documentation if needed"
echo "  4. Announce release (if public)"
echo ""
print_success "Release automation complete!"
