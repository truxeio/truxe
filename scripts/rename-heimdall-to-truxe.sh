#!/bin/bash

###############################################################################
# Truxe → Truxe Automated Rename Script
# Version: 1.0.0
# Purpose: Safely rename all Truxe references to Truxe
# Usage: ./scripts/rename-truxe-to-truxe.sh [--dry-run]
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DRY_RUN=false
BACKUP_DIR=".rename-backup"
LOG_FILE="rename-$(date +%Y%m%d-%H%M%S).log"

# Parse arguments
if [[ "$1" == "--dry-run" ]]; then
    DRY_RUN=true
    echo -e "${YELLOW}🔍 Running in DRY-RUN mode (no changes will be made)${NC}"
fi

# Function to log messages
log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

# Function to replace text in files
replace_in_files() {
    local pattern=$1
    local replacement=$2
    local file_pattern=$3
    local description=$4

    log "${BLUE}📝 $description${NC}"

    if [ "$DRY_RUN" = true ]; then
        log "   Would replace: $pattern → $replacement in $file_pattern"
        grep -rl "$pattern" --include="$file_pattern" . 2>/dev/null | head -5 | while read file; do
            log "   - $file"
        done
    else
        # Use find + sed for cross-platform compatibility
        find . -type f -name "$file_pattern" ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*" ! -path "*/build/*" -exec sed -i.bak "s/$pattern/$replacement/g" {} \;
        # Remove backup files
        find . -type f -name "*.bak" -delete
        log "${GREEN}   ✅ Completed${NC}"
    fi
}

# Function to replace case-sensitive
replace_case_sensitive() {
    local from=$1
    local to=$2
    local file_ext=$3
    local description=$4

    log "${BLUE}📝 $description${NC}"

    if [ "$DRY_RUN" = true ]; then
        log "   Would replace: $from → $to in *.$file_ext files"
        local count=$(grep -rl "$from" --include="*.$file_ext" . 2>/dev/null | wc -l)
        log "   Found in $count files"
    else
        find . -type f -name "*.$file_ext" ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*" -exec sed -i.bak "s/$from/$to/g" {} \;
        find . -type f -name "*.bak" -delete
        log "${GREEN}   ✅ Completed${NC}"
    fi
}

###############################################################################
# Main Rename Process
###############################################################################

log ""
log "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
log "${GREEN}║     Truxe → Truxe Automated Rename Process            ║${NC}"
log "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
log ""

# Step 1: Package Names
log "${YELLOW}━━━ Phase 1: Package Names ━━━${NC}"
replace_case_sensitive "@truxe/" "@truxe/" "json" "Updating scoped package names"
replace_case_sensitive "truxe-port-management" "truxe-port-management" "json" "Updating port management package"

# Step 2: Display Names & Descriptions
log ""
log "${YELLOW}━━━ Phase 2: Display Names & User-Facing Text ━━━${NC}"
replace_case_sensitive "\"Truxe API\"" "\"Truxe API\"" "js" "Updating API display name"
replace_case_sensitive "\"Truxe\"" "\"Truxe\"" "json" "Updating package display names"
replace_case_sensitive "Truxe Authentication" "Truxe Authentication" "md" "Updating documentation titles"

# Step 3: Environment Variables
log ""
log "${YELLOW}━━━ Phase 3: Environment Variables ━━━${NC}"
replace_case_sensitive "TRUXE_" "TRUXE_" "env" "Updating .env files"
replace_case_sensitive "TRUXE_" "TRUXE_" "env.example" "Updating .env.example files"
replace_case_sensitive "TRUXE_" "TRUXE_" "js" "Updating env var references in JS"
replace_case_sensitive "TRUXE_" "TRUXE_" "ts" "Updating env var references in TS"

# Step 4: Domain Names
log ""
log "${YELLOW}━━━ Phase 4: Domain Names ━━━${NC}"
replace_case_sensitive "truxe.io" "truxe.io" "*" "Updating domain references"
replace_case_sensitive "truxe.io" "truxe.io" "*" "Updating short domain references"
replace_case_sensitive "noreply@truxe" "noreply@truxe" "*" "Updating email addresses"

# Step 5: Docker Infrastructure
log ""
log "${YELLOW}━━━ Phase 5: Docker Infrastructure ━━━${NC}"
replace_case_sensitive "truxe-" "truxe-" "yml" "Updating docker-compose files"
replace_case_sensitive "truxe-" "truxe-" "yaml" "Updating YAML configs"
replace_case_sensitive "truxe_" "truxe_" "yml" "Updating volume/network names"

# Step 6: Database Names (in comments and docs only, not migrations)
log ""
log "${YELLOW}━━━ Phase 6: Database References (Safe) ━━━${NC}"
replace_case_sensitive "# truxe" "# truxe" "sql" "Updating SQL comments"
replace_case_sensitive "truxe.io" "truxe_dev" "env*" "Updating dev database names in env files"

# Step 7: Code Comments & Documentation
log ""
log "${YELLOW}━━━ Phase 7: Documentation & Comments ━━━${NC}"
replace_case_sensitive "# Truxe" "# Truxe" "js" "Updating JS comments"
replace_case_sensitive "# Truxe" "# Truxe" "ts" "Updating TS comments"
replace_case_sensitive "# Truxe" "# Truxe" "py" "Updating Python comments"
replace_case_sensitive "<!-- Truxe" "<!-- Truxe" "md" "Updating MD comments"

# Step 8: README Files
log ""
log "${YELLOW}━━━ Phase 8: README Files ━━━${NC}"
if [ "$DRY_RUN" = true ]; then
    log "   Would update all README.md files"
else
    find . -name "README.md" ! -path "*/node_modules/*" ! -path "*/.git/*" -exec sed -i.bak 's/Truxe/Truxe/g' {} \;
    find . -name "*.bak" -delete
    log "${GREEN}   ✅ Completed${NC}"
fi

# Summary
log ""
log "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
log "${GREEN}║                  Rename Summary                            ║${NC}"
log "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
log ""

if [ "$DRY_RUN" = true ]; then
    log "${YELLOW}⚠️  DRY-RUN completed. No changes were made.${NC}"
    log ""
    log "To apply changes, run:"
    log "  ${BLUE}./scripts/rename-truxe-to-truxe.sh${NC}"
else
    log "${GREEN}✅ Rename process completed successfully!${NC}"
    log ""
    log "Next steps:"
    log "  1. Review changes: ${BLUE}git status${NC}"
    log "  2. Check diff: ${BLUE}git diff${NC}"
    log "  3. Run tests: ${BLUE}npm test${NC}"
    log "  4. Commit changes: ${BLUE}git commit -m 'refactor: Rename Truxe to Truxe'${NC}"
fi

log ""
log "Log file: $LOG_FILE"
log ""